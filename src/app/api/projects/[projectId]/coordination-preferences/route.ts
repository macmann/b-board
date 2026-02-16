import { NextResponse, type NextRequest } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { normalizePreferencesInput, DEFAULT_COORDINATION_PREFERENCES } from "@/lib/coordination/preferences";

const canAccessProject = async (projectId: string, userId: string) => {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
    select: { id: true },
  });

  return Boolean(membership);
};

export async function GET(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { projectId } = await context.params;
  if (!(await canAccessProject(projectId, user.id))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.coordinationNotificationPreference.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });

  if (!existing) {
    return NextResponse.json({ preferences: DEFAULT_COORDINATION_PREFERENCES });
  }

  return NextResponse.json({
    preferences: normalizePreferencesInput({
      mutedCategories: (existing.mutedCategories as string[] | null) ?? undefined,
      quietHoursStart: existing.quietHoursStart,
      quietHoursEnd: existing.quietHoursEnd,
      timezoneOffsetMinutes: existing.timezoneOffsetMinutes,
      maxNudgesPerDay: existing.maxNudgesPerDay,
      channels: (existing.channels as string[] | null) ?? undefined,
    }),
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { projectId } = await context.params;
  if (!(await canAccessProject(projectId, user.id))) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const preferences = normalizePreferencesInput(body);

  const record = await prisma.coordinationNotificationPreference.upsert({
    where: { projectId_userId: { projectId, userId: user.id } },
    create: {
      projectId,
      userId: user.id,
      mutedCategories: preferences.mutedCategories,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      timezoneOffsetMinutes: preferences.timezoneOffsetMinutes,
      maxNudgesPerDay: preferences.maxNudgesPerDay,
      channels: preferences.channels,
    },
    update: {
      mutedCategories: preferences.mutedCategories,
      quietHoursStart: preferences.quietHoursStart,
      quietHoursEnd: preferences.quietHoursEnd,
      timezoneOffsetMinutes: preferences.timezoneOffsetMinutes,
      maxNudgesPerDay: preferences.maxNudgesPerDay,
      channels: preferences.channels,
    },
  });

  return NextResponse.json({
    preferences: normalizePreferencesInput({
      mutedCategories: (record.mutedCategories as string[] | null) ?? undefined,
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      timezoneOffsetMinutes: record.timezoneOffsetMinutes,
      maxNudgesPerDay: record.maxNudgesPerDay,
      channels: (record.channels as string[] | null) ?? undefined,
    }),
  });
}
