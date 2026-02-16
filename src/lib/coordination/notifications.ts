import { prisma } from "../db";
import { buildNudgeTemplate, type NudgeRuleId } from "./nudgeTemplates";
import {
  DEFAULT_COORDINATION_PREFERENCES,
  isWithinQuietHours,
  mapRuleToCategory,
  normalizePreferencesInput,
} from "./preferences";
import { calculateNudgeQualityMetrics, maybeAdjustSeverityForDismissalRate } from "./nudgeQuality";

const DEFAULT_DAILY_NOTIFICATION_LIMIT = 5;
const RECENT_ACTIVITY_SUPPRESSION_MINUTES = 30;
const DISMISSAL_RATE_THRESHOLD = 0.45;
const QUALITY_LOOKBACK_DAYS = 14;
const QUALITY_MIN_SAMPLE_SIZE = 10;
const DISMISSAL_COOLDOWN_HOURS = 24;
const RECENT_ACTIVITY_EVENT_TYPES = ["SUMMARY_VIEWED", "EVIDENCE_CLICKED", "FEEDBACK_SUBMITTED", "DIGEST_COPIED", "ACTION_INTERACTION"];

const NOTIFIABLE_RULE_IDS = new Set([
  "blocker-persisted-high-severity",
  "missing-standup-two-days",
  "question-unanswered-24h",
  "action-overdue",
  "snooze-expired-retrigger",
]);

type NotificationType = "PERSISTENT_BLOCKER" | "MISSING_STANDUP" | "UNANSWERED_QUESTION" | "ACTION_OVERDUE" | "ESCALATION";
type NotificationSeverity = "LOW" | "MEDIUM" | "HIGH";

type TriggerForNotification = {
  id: string;
  projectId: string;
  ruleId: string;
  targetUserId: string;
  relatedEntityId?: string | null;
  severity: NotificationSeverity;
  escalationLevel: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
};

const resolveType = (ruleId: string): NotificationType => {
  if (ruleId === "missing-standup-two-days") return "MISSING_STANDUP";
  if (ruleId === "question-unanswered-24h") return "UNANSWERED_QUESTION";
  if (ruleId === "action-overdue") return "ACTION_OVERDUE";
  if (ruleId === "snooze-expired-retrigger") return "ESCALATION";
  return "PERSISTENT_BLOCKER";
};

const shouldNotifyForTrigger = (trigger: TriggerForNotification) => {
  if (trigger.severity === "LOW") return false;
  return NOTIFIABLE_RULE_IDS.has(trigger.ruleId);
};

const isNudgeRuleId = (ruleId: string): ruleId is NudgeRuleId =>
  ["blocker-persisted-high-severity", "missing-standup-two-days", "question-unanswered-24h", "action-overdue", "snooze-expired-retrigger"].includes(
    ruleId
  );

const isPriorityTrigger = (trigger: TriggerForNotification) => trigger.escalationLevel >= 2 || trigger.severity === "HIGH";

const wasUserRecentlyActive = async (trigger: TriggerForNotification) => {
  const since = new Date(trigger.createdAt.getTime() - RECENT_ACTIVITY_SUPPRESSION_MINUTES * 60 * 1000);
  const recentActivity = await prisma.coordinationEvent.findFirst({
    where: {
      projectId: trigger.projectId,
      targetUserId: trigger.targetUserId,
      eventType: { in: RECENT_ACTIVITY_EVENT_TYPES },
      occurredAt: { gte: since },
    },
    select: { id: true },
  });

  return Boolean(recentActivity);
};

const wasQuestionAlreadyAnswered = async (trigger: TriggerForNotification) => {
  if (trigger.ruleId !== "question-unanswered-24h" || !trigger.relatedEntityId) return false;

  const answered = await prisma.coordinationEvent.findFirst({
    where: {
      projectId: trigger.projectId,
      relatedEntityId: trigger.relatedEntityId,
      eventType: "QUESTION_EVENT",
      metadata: {
        path: ["questionStatus"],
        equals: "ANSWERED",
      },
    },
    select: { id: true },
  });

  return Boolean(answered);
};

const wasBlockerRemoved = async (trigger: TriggerForNotification) => {
  if (trigger.ruleId !== "blocker-persisted-high-severity" || !trigger.relatedEntityId) return false;

  const removed = await prisma.coordinationEvent.findFirst({
    where: {
      projectId: trigger.projectId,
      relatedEntityId: trigger.relatedEntityId,
      eventType: { in: ["BLOCKER_PERSISTED", "ACTION_OVERDUE"] },
      metadata: {
        path: ["resolved"],
        equals: true,
      },
    },
    select: { id: true },
  });

  return Boolean(removed);
};

const isInDismissalCooldown = async (trigger: TriggerForNotification) => {
  const since = new Date(trigger.createdAt.getTime() - DISMISSAL_COOLDOWN_HOURS * 60 * 60 * 1000);
  const dismissed = await prisma.notification.findFirst({
    where: {
      userId: trigger.targetUserId,
      status: "DISMISSED",
      relatedEntityId: trigger.relatedEntityId ?? null,
      createdAt: { gte: since },
      trigger: {
        projectId: trigger.projectId,
        ruleId: trigger.ruleId,
      },
    },
    select: { id: true },
  });

  return Boolean(dismissed);
};

const getHistoricalQualityCounts = async (trigger: TriggerForNotification) => {
  const since = new Date(trigger.createdAt.getTime() - QUALITY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const [dismissedCount, resolvedCount] = await Promise.all([
    prisma.notification.count({
      where: {
        userId: trigger.targetUserId,
        status: "DISMISSED",
        trigger: {
          projectId: trigger.projectId,
          ruleId: trigger.ruleId,
          createdAt: { gte: since },
        },
      },
    }),
    prisma.notification.count({
      where: {
        userId: trigger.targetUserId,
        status: "READ",
        trigger: {
          projectId: trigger.projectId,
          ruleId: trigger.ruleId,
          status: "RESOLVED",
          createdAt: { gte: since },
        },
      },
    }),
  ]);

  return { dismissedCount, resolvedCount };
};

const loadUserProjectPreferences = async (trigger: TriggerForNotification) => {
  const record = await prisma.coordinationNotificationPreference.findUnique({
    where: {
      projectId_userId: {
        projectId: trigger.projectId,
        userId: trigger.targetUserId,
      },
    },
  });

  if (!record) return DEFAULT_COORDINATION_PREFERENCES;

  return normalizePreferencesInput({
    mutedCategories: (record.mutedCategories as string[] | null) ?? undefined,
    quietHoursStart: record.quietHoursStart,
    quietHoursEnd: record.quietHoursEnd,
    timezoneOffsetMinutes: record.timezoneOffsetMinutes,
    maxNudgesPerDay: record.maxNudgesPerDay,
    channels: (record.channels as string[] | null) ?? undefined,
  });
};

const buildWhyContext = (trigger: TriggerForNotification) => {
  const category = mapRuleToCategory(trigger.ruleId);
  const escalationExplanation =
    trigger.escalationLevel === 1
      ? "Day 2 signal notifies the owner."
      : trigger.escalationLevel === 2
        ? "Day 3 signal notifies dependency owner/manager."
        : "Day 4+ signal notifies lead or PO.";

  return {
    ruleId: trigger.ruleId,
    category,
    condition: {
      blocker: "Blocker persisted for 2+ days",
      standup: "Standup missing for 2+ days",
      question: "Clarification unanswered for 24+ hours",
      overdue: "Committed action remains overdue",
      snooze: "Previously snoozed reminder expired",
    },
    since: trigger.createdAt.toISOString(),
    escalation: {
      level: trigger.escalationLevel,
      explanation: escalationExplanation,
    },
    evidence: trigger.relatedEntityId
      ? {
          relatedEntityId: trigger.relatedEntityId,
          issueUrl: `/issues/${trigger.relatedEntityId}`,
        }
      : null,
  };
};

export async function createNotificationForTrigger(trigger: TriggerForNotification) {
  if (!shouldNotifyForTrigger(trigger)) {
    return { sent: false as const, reason: "suppressed-by-policy" as const };
  }

  const preferences = await loadUserProjectPreferences(trigger);
  if (!preferences.channels.includes("IN_APP")) {
    return { sent: false as const, reason: "suppressed-channel-disabled" as const };
  }

  const category = mapRuleToCategory(trigger.ruleId);
  if (preferences.mutedCategories.includes(category)) {
    return { sent: false as const, reason: "suppressed-category-muted" as const };
  }

  if (
    isWithinQuietHours({
      when: trigger.createdAt,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      timezoneOffsetMinutes: preferences.timezoneOffsetMinutes,
    })
  ) {
    return { sent: false as const, reason: "suppressed-quiet-hours" as const };
  }

  if (await wasUserRecentlyActive(trigger)) {
    return { sent: false as const, reason: "suppressed-recent-activity" as const };
  }

  if (await wasQuestionAlreadyAnswered(trigger)) {
    return { sent: false as const, reason: "suppressed-question-already-answered" as const };
  }

  if (await wasBlockerRemoved(trigger)) {
    return { sent: false as const, reason: "suppressed-blocker-removed" as const };
  }

  if (await isInDismissalCooldown(trigger)) {
    return { sent: false as const, reason: "suppressed-dismissal-cooldown" as const };
  }

  const startOfDay = new Date(trigger.createdAt);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const sentToday = await prisma.notification.count({
    where: {
      userId: trigger.targetUserId,
      createdAt: { gte: startOfDay },
    },
  });

  const dailyLimit = preferences.maxNudgesPerDay ?? DEFAULT_DAILY_NOTIFICATION_LIMIT;
  if (sentToday >= dailyLimit && !isPriorityTrigger(trigger)) {
    return { sent: false as const, reason: "daily-limit-reached" as const };
  }

  const qualityCounts = await getHistoricalQualityCounts(trigger);
  const quality = calculateNudgeQualityMetrics(qualityCounts);
  const sampleSize = qualityCounts.dismissedCount + qualityCounts.resolvedCount;
  const adjustedSeverity =
    sampleSize >= QUALITY_MIN_SAMPLE_SIZE
      ? maybeAdjustSeverityForDismissalRate({
          severity: trigger.severity,
          dismissedRate: quality.dismissedRate,
          dismissalRateThreshold: DISMISSAL_RATE_THRESHOLD,
        })
      : trigger.severity;

  if (adjustedSeverity === "LOW") {
    return { sent: false as const, reason: "suppressed-high-dismissal-rate" as const, quality };
  }

  const type = resolveType(trigger.ruleId);
  if (!isNudgeRuleId(trigger.ruleId)) {
    return { sent: false as const, reason: "unsupported-template" as const };
  }

  const copy = buildNudgeTemplate({
    ruleId: trigger.ruleId,
    escalationLevel: trigger.escalationLevel,
  });

  const why = buildWhyContext(trigger);
  const notification = await prisma.notification.create({
    data: {
      userId: trigger.targetUserId,
      triggerId: trigger.id,
      type,
      severity: adjustedSeverity,
      title: copy.title,
      body: copy.body,
      relatedEntityId: trigger.relatedEntityId ?? null,
      context: {
        why,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      projectId: trigger.projectId,
      actorType: "SYSTEM",
      action: "NotificationSent",
      entityType: "SETTINGS",
      entityId: notification.id,
      summary: `NotificationSent for trigger ${trigger.id}`,
      metadata: {
        notificationId: notification.id,
        triggerId: trigger.id,
        userId: trigger.targetUserId,
        type,
        nudge_quality: {
          resolved_rate: quality.resolvedRate,
          dismissed_rate: quality.dismissedRate,
          sample_size: sampleSize,
        },
      },
    },
  });

  return { sent: true as const, notificationId: notification.id, quality };
}

export async function emitNotificationTelemetry(input: {
  action: "NotificationViewed" | "NotificationResolved" | "NotificationDismissed";
  projectId: string;
  notificationId: string;
  triggerId: string;
  userId: string;
}) {
  await prisma.auditLog.create({
    data: {
      projectId: input.projectId,
      actorType: "SYSTEM",
      action: input.action,
      entityType: "SETTINGS",
      entityId: input.notificationId,
      summary: `${input.action} for trigger ${input.triggerId}`,
      metadata: {
        notificationId: input.notificationId,
        triggerId: input.triggerId,
        userId: input.userId,
      },
    },
  });
}
