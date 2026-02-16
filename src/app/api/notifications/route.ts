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
        select: { projectId: true },
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

  return NextResponse.json({ notifications });
}
