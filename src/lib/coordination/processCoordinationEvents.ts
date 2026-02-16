import { prisma } from "../db";
import { evaluateCoordinationRules, getRuleById, type CoordinationRule } from "./coordinationRules";
import type { CoordinationEvent, CoordinationLogEntry, CoordinationTrigger, CoordinationTriggerDraft } from "./types";

const EVENT_LOOKBACK_HOURS = 72;

type ResolveInput = {
  projectId: string;
  relatedEntityId?: string | null;
  ruleIds?: string[];
  resolvedAt: Date;
};

export type CoordinationStore = {
  getEvents: (input: { eventIds?: string[]; since: Date; projectId?: string }) => Promise<CoordinationEvent[]>;
  markEventProcessed: (eventId: string, processedAt: Date) => Promise<void>;
  getLatestTriggerByDedupKey: (input: { dedupKey: string; projectId: string }) => Promise<CoordinationTrigger | null>;
  createTrigger: (draft: CoordinationTriggerDraft, createdAt: Date) => Promise<void>;
  resolveTriggers: (input: ResolveInput) => Promise<number>;
  getPendingTriggerAges: (input: { projectId?: string; now: Date }) => Promise<CoordinationEvent[]>;
};

const prismaAny = prisma as any;

const prismaStore: CoordinationStore = {
  async getEvents({ eventIds, since, projectId }) {
    const rows = await prismaAny.coordinationEvent.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(eventIds?.length ? { id: { in: eventIds } } : { occurredAt: { gte: since }, processedAt: null }),
      },
      orderBy: { occurredAt: "asc" },
    });

    return rows.map((row: any) => ({
      id: row.id,
      projectId: row.projectId,
      eventType: row.eventType,
      targetUserId: row.targetUserId,
      relatedEntityId: row.relatedEntityId,
      severity: row.severity,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
      occurredAt: row.occurredAt,
      processedAt: row.processedAt,
    }));
  },
  async markEventProcessed(eventId, processedAt) {
    await prismaAny.coordinationEvent.update({ where: { id: eventId }, data: { processedAt } });
  },
  async getLatestTriggerByDedupKey({ dedupKey, projectId }) {
    const trigger = await prismaAny.coordinationTrigger.findFirst({
      where: { dedupKey, projectId },
      orderBy: { createdAt: "desc" },
    });

    if (!trigger) return null;

    return {
      id: trigger.id,
      projectId: trigger.projectId,
      ruleId: trigger.ruleId,
      targetUserId: trigger.targetUserId,
      relatedEntityId: trigger.relatedEntityId,
      severity: trigger.severity,
      createdAt: trigger.createdAt,
      status: trigger.status,
      resolvedAt: trigger.resolvedAt,
      escalationLevel: trigger.escalationLevel,
      dedupKey: trigger.dedupKey,
    };
  },
  async createTrigger(draft, createdAt) {
    await prismaAny.coordinationTrigger.create({
      data: {
        projectId: draft.projectId,
        ruleId: draft.ruleId,
        targetUserId: draft.targetUserId,
        relatedEntityId: draft.relatedEntityId,
        severity: draft.severity,
        escalationLevel: draft.escalationLevel,
        dedupKey: draft.dedupKey,
        createdAt,
      },
    });
  },
  async resolveTriggers({ projectId, relatedEntityId, ruleIds, resolvedAt }) {
    if (!relatedEntityId && !ruleIds?.length) return 0;

    const result = await prismaAny.coordinationTrigger.updateMany({
      where: {
        projectId,
        status: { in: ["PENDING", "SENT"] },
        ...(relatedEntityId ? { relatedEntityId } : {}),
        ...(ruleIds?.length ? { ruleId: { in: ruleIds } } : {}),
      },
      data: {
        status: "RESOLVED",
        resolvedAt,
      },
    });

    return result.count ?? 0;
  },
  async getPendingTriggerAges({ projectId, now }) {
    const triggers = await prismaAny.coordinationTrigger.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: { in: ["PENDING", "SENT"] },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    return triggers.map((trigger: any) => ({
      id: `synthetic-${trigger.id}`,
      projectId: trigger.projectId,
      eventType: trigger.ruleId === "question-unanswered-24h" ? "QUESTION_UNANSWERED" : "BLOCKER_PERSISTED",
      targetUserId: trigger.targetUserId,
      relatedEntityId: trigger.relatedEntityId,
      severity: trigger.severity,
      metadata:
        trigger.ruleId === "question-unanswered-24h"
          ? { unansweredHours: Math.floor((now.getTime() - trigger.createdAt.getTime()) / (60 * 60 * 1000)) }
          : { blockerDays: Math.floor((now.getTime() - trigger.createdAt.getTime()) / (24 * 60 * 60 * 1000)) + 2 },
      occurredAt: now,
      processedAt: null,
    }));
  },
};

const withinCooldown = (now: Date, triggerCreatedAt: Date, cooldownMinutes: number) => {
  const threshold = now.getTime() - cooldownMinutes * 60 * 1000;
  return triggerCreatedAt.getTime() >= threshold;
};

const ruleIdsToResolveForEvent = (event: CoordinationEvent): string[] => {
  if (event.eventType === "ACTION_INTERACTION" && event.metadata?.actionState === "DONE") {
    return ["blocker-persisted-high-severity"];
  }

  if (event.eventType === "QUESTION_EVENT" && event.metadata?.questionStatus === "ANSWERED") {
    return ["question-unanswered-24h"];
  }

  if ((event.eventType === "BLOCKER_PERSISTED" || event.eventType === "ACTION_OVERDUE") && event.metadata?.resolved === true) {
    return ["blocker-persisted-high-severity"];
  }

  return [];
};

const shouldSuppressByCooldown = (
  now: Date,
  latest: CoordinationTrigger | null,
  rule: CoordinationRule,
  logs?: CoordinationLogEntry[]
) => {
  if (!latest) return false;
  if (latest.status === "RESOLVED") return false;

  const suppressed = withinCooldown(now, latest.createdAt, rule.cooldownMinutes);
  if (suppressed && logs) {
    logs.push({
      level: "debug",
      ruleId: rule.id,
      dedupKey: latest.dedupKey,
      message: `Suppressed by cooldown (${rule.cooldownMinutes}m window).`,
    });
  }
  return suppressed;
};

export async function processCoordinationEvents(input?: {
  eventIds?: string[];
  projectId?: string;
  now?: Date;
  store?: CoordinationStore;
  includeDiagnostics?: boolean;
}) {
  const now = input?.now ?? new Date();
  const since = new Date(now.getTime() - EVENT_LOOKBACK_HOURS * 60 * 60 * 1000);
  const store = input?.store ?? prismaStore;
  const logs: CoordinationLogEntry[] = [];

  const events = await store.getEvents({
    eventIds: input?.eventIds,
    projectId: input?.projectId,
    since,
  });

  let createdCount = 0;
  let resolvedCount = 0;

  for (const event of events) {
    const ruleIds = ruleIdsToResolveForEvent(event);
    if (ruleIds.length || event.relatedEntityId) {
      const resolved = await store.resolveTriggers({
        projectId: event.projectId,
        relatedEntityId: event.relatedEntityId,
        ruleIds,
        resolvedAt: now,
      });
      resolvedCount += resolved;
      if (resolved > 0) {
        logs.push({
          level: "info",
          eventId: event.id,
          message: `Resolved ${resolved} trigger(s) from lifecycle event ${event.eventType}.`,
        });
      }
    }

    const triggerDrafts = evaluateCoordinationRules({ event, now });
    for (const draft of triggerDrafts) {
      const rule = getRuleById(draft.ruleId);
      if (!rule) continue;

      const latest = await store.getLatestTriggerByDedupKey({
        dedupKey: draft.dedupKey,
        projectId: draft.projectId,
      });

      if (shouldSuppressByCooldown(now, latest, rule, logs)) {
        continue;
      }

      await store.createTrigger(draft, now);
      createdCount += 1;
      logs.push({
        level: "info",
        eventId: event.id,
        ruleId: draft.ruleId,
        dedupKey: draft.dedupKey,
        message: `Created trigger at escalation L${draft.escalationLevel}.`,
      });
    }

    if (!event.processedAt) {
      await store.markEventProcessed(event.id, now);
    }
  }

  return {
    processedEvents: events.length,
    createdTriggers: createdCount,
    resolvedTriggers: resolvedCount,
    diagnostics: input?.includeDiagnostics ? logs : undefined,
  };
}

export async function resolveTriggersForEntity(input: {
  projectId: string;
  relatedEntityId: string;
  ruleIds?: string[];
  resolvedAt?: Date;
  store?: CoordinationStore;
}) {
  const store = input.store ?? prismaStore;
  return store.resolveTriggers({
    projectId: input.projectId,
    relatedEntityId: input.relatedEntityId,
    ruleIds: input.ruleIds,
    resolvedAt: input.resolvedAt ?? new Date(),
  });
}

export async function runScheduledCoordinationSweep(input?: {
  projectId?: string;
  now?: Date;
  store?: CoordinationStore;
}) {
  const store = input?.store ?? prismaStore;
  const now = input?.now ?? new Date();

  const syntheticAgingEvents = await store.getPendingTriggerAges({
    projectId: input?.projectId,
    now,
  });

  const sweepStore: CoordinationStore = {
    getEvents(getInput) {
      if (getInput.eventIds?.length) return store.getEvents(getInput);
      return Promise.resolve(syntheticAgingEvents);
    },
    markEventProcessed: (eventId, processedAt) => store.markEventProcessed(eventId, processedAt),
    getLatestTriggerByDedupKey: (lookup) => store.getLatestTriggerByDedupKey(lookup),
    createTrigger: (draft, createdAt) => store.createTrigger(draft, createdAt),
    resolveTriggers: (resolveInput) => store.resolveTriggers(resolveInput),
    getPendingTriggerAges: (ageInput) => store.getPendingTriggerAges(ageInput),
  };

  return processCoordinationEvents({
    now,
    projectId: input?.projectId,
    store: sweepStore,
    includeDiagnostics: true,
  });
}

export async function recordCoordinationEvent(input: {
  projectId: string;
  eventType: CoordinationEvent["eventType"];
  targetUserId?: string | null;
  relatedEntityId?: string | null;
  severity?: CoordinationEvent["severity"];
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
  processImmediately?: boolean;
}) {
  const event = await prismaAny.coordinationEvent.create({
    data: {
      projectId: input.projectId,
      eventType: input.eventType,
      targetUserId: input.targetUserId ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      severity: input.severity ?? null,
      metadata: input.metadata,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });

  if (input.processImmediately ?? true) {
    await processCoordinationEvents({ eventIds: [event.id], projectId: input.projectId });
  }

  return event;
}
