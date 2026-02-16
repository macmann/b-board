import { NextResponse, type NextRequest } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { emitNotificationTelemetry } from "@/lib/coordination/notifications";

const normalizeStatus = (raw: string | null) => {
  if (!raw) return null;
  const value = raw.toUpperCase();
  if (value === "UNREAD" || value === "READ" || value === "DISMISSED") return value;
  return null;
};

const resolveRuleCondition = (ruleId: string) => {
  if (ruleId === "missing-standup-two-days") return "Triggered after 2+ missed standup days.";
  if (ruleId === "question-unanswered-24h") return "Triggered after 24+ hours without clarification response.";
  if (ruleId === "action-overdue") return "Triggered by overdue committed action.";
  if (ruleId === "snooze-expired-retrigger") return "Triggered because a snoozed reminder expired.";
  return "Triggered by blocker persistence for 2+ days.";
};

const resolveEscalationExplanation = (level: number) => {
  if (level >= 3) return "Level 3: escalated to lead/PO (day 4+).";
  if (level === 2) return "Level 2: escalated to dependency owner/manager (day 3).";
  return "Level 1: owner reminder (day 2).";
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const status = normalizeStatus(request.nextUrl.searchParams.get("status"));
  const projectId = request.nextUrl.searchParams.get("projectId");

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      ...(status ? { status } : {}),
      ...(projectId ? { trigger: { projectId } } : {}),
    },
    include: {
      trigger: {
        select: {
          projectId: true,
          ruleId: true,
          escalationLevel: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  await Promise.all(
    notifications
      .filter((notification) => notification.status === "UNREAD")
      .map((notification) =>
        emitNotificationTelemetry({
          action: "NotificationViewed",
          projectId: notification.trigger.projectId,
          notificationId: notification.id,
          triggerId: notification.triggerId,
          userId: user.id,
        })
      )
  );

  const payload = notifications.map((notification) => ({
    ...notification,
    why:
      ((notification.context as { why?: Record<string, unknown> } | null)?.why as Record<string, unknown> | undefined) ?? {
        ruleId: notification.trigger.ruleId,
        condition: resolveRuleCondition(notification.trigger.ruleId),
        since: notification.trigger.createdAt.toISOString(),
        escalation: {
          level: notification.trigger.escalationLevel,
          explanation: resolveEscalationExplanation(notification.trigger.escalationLevel),
        },
        evidence: notification.relatedEntityId ? { issueUrl: `/issues/${notification.relatedEntityId}` } : null,
      },
  }));

  return NextResponse.json({ notifications: payload });
}
