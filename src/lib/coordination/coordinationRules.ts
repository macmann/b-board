import type { CoordinationEvent, CoordinationSeverity, CoordinationTriggerDraft } from "./types";

export type CoordinationRuleContext = {
  event: CoordinationEvent;
  now: Date;
};

export type CoordinationRule = {
  id: string;
  triggerEvent: CoordinationEvent["eventType"];
  cooldownMinutes: number;
  condition: (context: CoordinationRuleContext) => boolean;
  action: (context: CoordinationRuleContext) => Omit<CoordinationTriggerDraft, "ruleId" | "dedupKey"> | null;
};

const severityAtLeast = (actual: CoordinationSeverity | null | undefined, minimum: CoordinationSeverity) => {
  const rank: Record<CoordinationSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  return rank[actual ?? "LOW"] >= rank[minimum];
};

const numberMeta = (event: CoordinationEvent, key: string) => {
  const raw = event.metadata?.[key];
  return typeof raw === "number" ? raw : null;
};

const stringMeta = (event: CoordinationEvent, key: string) => {
  const raw = event.metadata?.[key];
  return typeof raw === "string" && raw.trim() ? raw : null;
};

const resolveEscalationTarget = (
  event: CoordinationEvent,
  escalationLevel: number,
  fallbackTargetUserId?: string | null
): string | null => {
  if (escalationLevel >= 3) {
    return stringMeta(event, "poUserId") ?? stringMeta(event, "projectOwnerUserId") ?? fallbackTargetUserId ?? null;
  }
  if (escalationLevel === 2) {
    return stringMeta(event, "dependencyOwnerUserId") ?? stringMeta(event, "managerUserId") ?? fallbackTargetUserId ?? null;
  }
  return fallbackTargetUserId ?? null;
};

const blockerEscalationLevel = (event: CoordinationEvent) => {
  const blockerDays = numberMeta(event, "blockerDays") ?? 0;
  if (blockerDays >= 4) return 3;
  if (blockerDays >= 3) return 2;
  return 1;
};

const missingStandupEscalationLevel = (event: CoordinationEvent) => {
  const missingDays = numberMeta(event, "missingDays") ?? 0;
  if (missingDays >= 4) return 3;
  if (missingDays >= 3) return 2;
  return 1;
};

const questionEscalationLevel = (event: CoordinationEvent) => {
  const unansweredHours = numberMeta(event, "unansweredHours") ?? 0;
  if (unansweredHours >= 72) return 3;
  if (unansweredHours >= 48) return 2;
  return 1;
};

export const COORDINATION_RULES: CoordinationRule[] = [
  {
    id: "blocker-persisted-high-severity",
    triggerEvent: "BLOCKER_PERSISTED",
    cooldownMinutes: 24 * 60,
    condition: ({ event }) => {
      const blockerDays = numberMeta(event, "blockerDays") ?? 0;
      return blockerDays >= 2 && severityAtLeast(event.severity, "HIGH");
    },
    action: ({ event }) => {
      const escalationLevel = blockerEscalationLevel(event);
      const targetUserId = resolveEscalationTarget(event, escalationLevel, event.targetUserId);
      if (!targetUserId) return null;

      return {
        projectId: event.projectId,
        targetUserId,
        relatedEntityId: event.relatedEntityId,
        severity: "HIGH",
        escalationLevel,
      };
    },
  },
  {
    id: "missing-standup-two-days",
    triggerEvent: "MISSING_STANDUP_DETECTED",
    cooldownMinutes: 24 * 60,
    condition: ({ event }) => {
      const missingDays = numberMeta(event, "missingDays") ?? 0;
      return missingDays >= 2;
    },
    action: ({ event }) => {
      const escalationLevel = missingStandupEscalationLevel(event);
      const targetUserId = resolveEscalationTarget(event, escalationLevel, event.targetUserId);
      if (!targetUserId) return null;

      return {
        projectId: event.projectId,
        targetUserId,
        relatedEntityId: event.relatedEntityId,
        severity: event.severity ?? "MEDIUM",
        escalationLevel,
      };
    },
  },
  {
    id: "question-unanswered-24h",
    triggerEvent: "QUESTION_UNANSWERED",
    cooldownMinutes: 24 * 60,
    condition: ({ event }) => {
      const unansweredHours = numberMeta(event, "unansweredHours") ?? 0;
      return unansweredHours >= 24;
    },
    action: ({ event }) => {
      const escalationLevel = questionEscalationLevel(event);
      const targetUserId = resolveEscalationTarget(event, escalationLevel, event.targetUserId);
      if (!targetUserId) return null;

      return {
        projectId: event.projectId,
        targetUserId,
        relatedEntityId: event.relatedEntityId,
        severity: event.severity ?? "MEDIUM",
        escalationLevel,
      };
    },
  },
];

export const buildTriggerDedupKey = (
  ruleId: string,
  targetUserId: string,
  relatedEntityId?: string | null,
  escalationLevel?: number
) => `${ruleId}:${targetUserId}:${relatedEntityId ?? "none"}:L${escalationLevel ?? 1}`;

export const evaluateCoordinationRules = (context: CoordinationRuleContext): CoordinationTriggerDraft[] =>
  COORDINATION_RULES.filter((rule) => rule.triggerEvent === context.event.eventType)
    .filter((rule) => rule.condition(context))
    .map((rule) => {
      const draft = rule.action(context);
      if (!draft) return null;

      return {
        ...draft,
        ruleId: rule.id,
        dedupKey: buildTriggerDedupKey(rule.id, draft.targetUserId, draft.relatedEntityId, draft.escalationLevel),
      } satisfies CoordinationTriggerDraft;
    })
    .filter((draft): draft is CoordinationTriggerDraft => Boolean(draft));

export const getRuleById = (ruleId: string) => COORDINATION_RULES.find((rule) => rule.id === ruleId) ?? null;
