import { describe, expect, it } from "vitest";

import {
  processCoordinationEvents,
  runScheduledCoordinationSweep,
  type CoordinationStore,
} from "./processCoordinationEvents";
import type { CoordinationEvent, CoordinationTrigger, CoordinationTriggerDraft } from "./types";

class InMemoryCoordinationStore implements CoordinationStore {
  constructor(
    private readonly events: CoordinationEvent[],
    private readonly triggers: CoordinationTrigger[] = []
  ) {}

  async getEvents(input: { eventIds?: string[]; since: Date; projectId?: string }): Promise<CoordinationEvent[]> {
    return this.events.filter((event) => {
      if (input.projectId && event.projectId !== input.projectId) return false;
      if (input.eventIds?.length) return input.eventIds.includes(event.id);
      return event.occurredAt.getTime() >= input.since.getTime() && !event.processedAt;
    });
  }

  async markEventProcessed(eventId: string, processedAt: Date): Promise<void> {
    const match = this.events.find((event) => event.id === eventId);
    if (match) match.processedAt = processedAt;
  }

  async getLatestTriggerByDedupKey(input: { dedupKey: string; projectId: string }): Promise<CoordinationTrigger | null> {
    const matches = this.triggers
      .filter((trigger) => trigger.dedupKey === input.dedupKey && trigger.projectId === input.projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return matches[0] ?? null;
  }

  async createTrigger(draft: CoordinationTriggerDraft, createdAt: Date): Promise<void> {
    this.triggers.push({
      id: `trigger-${this.triggers.length + 1}`,
      ...draft,
      createdAt,
      status: "PENDING",
    });
  }

  async resolveTriggers(input: {
    projectId: string;
    relatedEntityId?: string | null;
    ruleIds?: string[];
    resolvedAt: Date;
  }): Promise<number> {
    let count = 0;
    for (const trigger of this.triggers) {
      if (trigger.projectId !== input.projectId) continue;
      if (!["PENDING", "SENT"].includes(trigger.status)) continue;
      if (input.relatedEntityId && trigger.relatedEntityId !== input.relatedEntityId) continue;
      if (input.ruleIds?.length && !input.ruleIds.includes(trigger.ruleId)) continue;
      trigger.status = "RESOLVED";
      trigger.resolvedAt = input.resolvedAt;
      count += 1;
    }
    return count;
  }

  async getPendingTriggerAges(input: { projectId?: string; now: Date }): Promise<CoordinationEvent[]> {
    return this.triggers
      .filter((trigger) => trigger.status === "PENDING" || trigger.status === "SENT")
      .filter((trigger) => (input.projectId ? trigger.projectId === input.projectId : true))
      .map((trigger) => ({
        id: `synthetic-${trigger.id}`,
        projectId: trigger.projectId,
        eventType: trigger.ruleId === "question-unanswered-24h" ? "QUESTION_UNANSWERED" : "BLOCKER_PERSISTED",
        targetUserId: trigger.targetUserId,
        relatedEntityId: trigger.relatedEntityId,
        severity: trigger.severity,
        metadata:
          trigger.ruleId === "question-unanswered-24h"
            ? { unansweredHours: Math.floor((input.now.getTime() - trigger.createdAt.getTime()) / (60 * 60 * 1000)) }
            : { blockerDays: 3 },
        occurredAt: input.now,
      }));
  }

  getCreatedTriggers() {
    return this.triggers;
  }

  getEventById(id: string) {
    return this.events.find((event) => event.id === id);
  }
}

describe("processCoordinationEvents", () => {
  it("is idempotent for already processed events", async () => {
    const now = new Date("2026-02-20T12:00:00.000Z");
    const event: CoordinationEvent = {
      id: "evt-1",
      projectId: "project-1",
      eventType: "BLOCKER_PERSISTED",
      targetUserId: "user-1",
      relatedEntityId: "issue-1",
      severity: "HIGH",
      metadata: { blockerDays: 2 },
      occurredAt: new Date("2026-02-20T11:00:00.000Z"),
    };

    const store = new InMemoryCoordinationStore([event]);

    await processCoordinationEvents({ store, now });
    const secondRun = await processCoordinationEvents({ store, now });

    expect(secondRun).toMatchObject({ processedEvents: 0, createdTriggers: 0 });
    expect(store.getEventById("evt-1")?.processedAt).toEqual(now);
    expect(store.getCreatedTriggers()).toHaveLength(1);
  });

  it("resolves unanswered question triggers when question is answered", async () => {
    const now = new Date("2026-02-20T12:00:00.000Z");
    const answeredEvent: CoordinationEvent = {
      id: "evt-2",
      projectId: "project-1",
      eventType: "QUESTION_EVENT",
      targetUserId: "user-2",
      relatedEntityId: "question-1",
      severity: "MEDIUM",
      metadata: { questionStatus: "ANSWERED" },
      occurredAt: new Date("2026-02-20T11:00:00.000Z"),
    };

    const existing: CoordinationTrigger = {
      id: "existing-trigger",
      projectId: "project-1",
      ruleId: "question-unanswered-24h",
      targetUserId: "user-2",
      relatedEntityId: "question-1",
      severity: "MEDIUM",
      createdAt: new Date("2026-02-19T10:00:00.000Z"),
      status: "PENDING",
      escalationLevel: 1,
      dedupKey: "question-unanswered-24h:user-2:question-1:L1",
    };

    const store = new InMemoryCoordinationStore([answeredEvent], [existing]);
    const result = await processCoordinationEvents({ store, now });

    expect(result).toMatchObject({ resolvedTriggers: 1 });
    expect(store.getCreatedTriggers()[0].status).toBe("RESOLVED");
  });

  it("resolves blocker triggers when action is marked DONE", async () => {
    const now = new Date("2026-02-20T12:00:00.000Z");
    const doneEvent: CoordinationEvent = {
      id: "evt-done",
      projectId: "project-1",
      eventType: "ACTION_INTERACTION",
      targetUserId: "user-2",
      relatedEntityId: "issue-1",
      severity: "MEDIUM",
      metadata: { actionState: "DONE" },
      occurredAt: new Date("2026-02-20T11:00:00.000Z"),
    };

    const existing: CoordinationTrigger = {
      id: "existing-blocker",
      projectId: "project-1",
      ruleId: "blocker-persisted-high-severity",
      targetUserId: "user-2",
      relatedEntityId: "issue-1",
      severity: "HIGH",
      createdAt: new Date("2026-02-19T10:00:00.000Z"),
      status: "PENDING",
      escalationLevel: 1,
      dedupKey: "blocker-persisted-high-severity:user-2:issue-1:L1",
    };

    const store = new InMemoryCoordinationStore([doneEvent], [existing]);
    const result = await processCoordinationEvents({ store, now });

    expect(result.resolvedTriggers).toBe(1);
    expect(store.getCreatedTriggers()[0].status).toBe("RESOLVED");
  });

  it("creates a new trigger when snooze expires", async () => {
    const now = new Date("2026-02-20T12:00:00.000Z");
    const snoozeExpired: CoordinationEvent = {
      id: "evt-snooze",
      projectId: "project-1",
      eventType: "SNOOZE_EXPIRED",
      targetUserId: "user-3",
      relatedEntityId: "issue-8",
      severity: "MEDIUM",
      metadata: { retrigger: true, previousEscalationLevel: 2 },
      occurredAt: new Date("2026-02-20T11:00:00.000Z"),
    };

    const store = new InMemoryCoordinationStore([snoozeExpired]);
    const result = await processCoordinationEvents({ store, now });

    expect(result.createdTriggers).toBe(1);
    expect(store.getCreatedTriggers()[0]).toMatchObject({
      ruleId: "snooze-expired-retrigger",
      escalationLevel: 2,
    });
  });

  it("allows escalated question reminder when scheduled sweep sees 72h age", async () => {
    const now = new Date("2026-02-22T12:00:00.000Z");
    const existing: CoordinationTrigger = {
      id: "existing-trigger",
      projectId: "project-1",
      ruleId: "question-unanswered-24h",
      targetUserId: "assignee",
      relatedEntityId: "question-1",
      severity: "MEDIUM",
      createdAt: new Date("2026-02-19T10:00:00.000Z"),
      status: "PENDING",
      escalationLevel: 1,
      dedupKey: "question-unanswered-24h:assignee:question-1:L1",
    };

    const store = new InMemoryCoordinationStore([], [existing]);
    const result = await runScheduledCoordinationSweep({ store, now, projectId: "project-1" });

    expect(result.createdTriggers).toBe(1);
    expect(store.getCreatedTriggers()).toHaveLength(2);
    expect(store.getCreatedTriggers()[1]).toMatchObject({
      ruleId: "question-unanswered-24h",
      escalationLevel: 3,
      dedupKey: "question-unanswered-24h:assignee:question-1:L3",
    });
  });
});
