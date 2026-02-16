import { prisma } from "../db";

const DAILY_NOTIFICATION_LIMIT = 5;

const NOTIFIABLE_RULE_IDS = new Set([
  "blocker-persisted-high-severity",
  "missing-standup-two-days",
  "question-unanswered-24h",
  "action-overdue",
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
};

const resolveType = (ruleId: string): NotificationType => {
  if (ruleId === "missing-standup-two-days") return "MISSING_STANDUP";
  if (ruleId === "question-unanswered-24h") return "UNANSWERED_QUESTION";
  if (ruleId === "action-overdue") return "ACTION_OVERDUE";
  return "PERSISTENT_BLOCKER";
};

const resolveTitle = (trigger: TriggerForNotification) => {
  switch (trigger.ruleId) {
    case "missing-standup-two-days":
      return "Missing standup follow-up";
    case "question-unanswered-24h":
      return "Unanswered question needs attention";
    case "action-overdue":
      return "Action item overdue";
    default:
      return "Persistent blocker requires action";
  }
};

const resolveBody = (trigger: TriggerForNotification) => {
  const escalationText = trigger.escalationLevel > 1 ? ` Escalation level: L${trigger.escalationLevel}.` : "";
  switch (trigger.ruleId) {
    case "missing-standup-two-days":
      return `A teammate has missed multiple standups. Please review and unblock execution.${escalationText}`;
    case "question-unanswered-24h":
      return `A project question has gone unanswered and may be slowing delivery.${escalationText}`;
    case "action-overdue":
      return `A committed action item is overdue and needs owner follow-through.${escalationText}`;
    default:
      return `A blocker has persisted and now requires direct intervention.${escalationText}`;
  }
};

const shouldNotifyForTrigger = (trigger: TriggerForNotification) => {
  if (trigger.severity === "LOW") return false;
  return NOTIFIABLE_RULE_IDS.has(trigger.ruleId);
};

export async function createNotificationForTrigger(trigger: TriggerForNotification) {
  if (!shouldNotifyForTrigger(trigger)) {
    return { sent: false as const, reason: "suppressed-by-policy" as const };
  }

  const startOfDay = new Date(trigger.createdAt);
  startOfDay.setUTCHours(0, 0, 0, 0);

  const sentToday = await prisma.notification.count({
    where: {
      userId: trigger.targetUserId,
      createdAt: { gte: startOfDay },
    },
  });

  if (sentToday >= DAILY_NOTIFICATION_LIMIT) {
    return { sent: false as const, reason: "daily-limit-reached" as const };
  }

  const type = resolveType(trigger.ruleId);
  const notification = await prisma.notification.create({
    data: {
      userId: trigger.targetUserId,
      triggerId: trigger.id,
      type,
      severity: trigger.severity,
      title: resolveTitle(trigger),
      body: resolveBody(trigger),
      relatedEntityId: trigger.relatedEntityId ?? null,
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
      },
    },
  });

  return { sent: true as const, notificationId: notification.id };
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
