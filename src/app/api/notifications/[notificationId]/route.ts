import { NextResponse, type NextRequest } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { emitNotificationTelemetry } from "@/lib/coordination/notifications";

export async function PATCH(request: NextRequest, context: { params: Promise<{ notificationId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { action?: string };

  const existing = await prisma.notification.findFirst({
    where: {
      id: params.notificationId,
      userId: user.id,
    },
    include: {
      trigger: {
        select: { projectId: true },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ message: "Notification not found" }, { status: 404 });
  }

  const action = payload.action === "dismiss" ? "dismiss" : "read";
  const nextStatus = action === "dismiss" ? "DISMISSED" : "READ";

  const updated = await prisma.notification.update({
    where: { id: existing.id },
    data: { status: nextStatus },
  });

  if (action === "dismiss") {
    await emitNotificationTelemetry({
      action: "NotificationDismissed",
      projectId: existing.trigger.projectId,
      notificationId: existing.id,
      triggerId: existing.triggerId,
      userId: user.id,
    });
  }

  return NextResponse.json({ notification: updated });
}
