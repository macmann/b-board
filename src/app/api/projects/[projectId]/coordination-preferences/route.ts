import { NextResponse, type NextRequest } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import {
  type CoordinationChannel,
  type CoordinationNudgeCategory,
  normalizePreferencesInput,
  DEFAULT_COORDINATION_PREFERENCES,
} from "@/lib/coordination/preferences";
import prisma from "@/lib/db";

const asCoordinationNudgeCategories = (value: unknown): CoordinationNudgeCategory[] | undefined =>
  Array.isArray(value) ? (value.filter((item): item is CoordinationNudgeCategory => typeof item === "string") as CoordinationNudgeCategory[]) : undefined;

const asCoordinationChannels = (value: unknown): CoordinationChannel[] | undefined =>
  Array.isArray(value) ? (value.filter((item): item is CoordinationChannel => item === "IN_APP") as CoordinationChannel[]) : undefined;

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
      mutedCategories: asCoordinationNudgeCategories(existing.mutedCategories),
      quietHoursStart: existing.quietHoursStart,
      quietHoursEnd: existing.quietHoursEnd,
      timezoneOffsetMinutes: existing.timezoneOffsetMinutes,
      maxNudgesPerDay: existing.maxNudgesPerDay,
      channels: asCoordinationChannels(existing.channels),
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
      mutedCategories: asCoordinationNudgeCategories(record.mutedCategories),
      quietHoursStart: record.quietHoursStart,
      quietHoursEnd: record.quietHoursEnd,
      timezoneOffsetMinutes: record.timezoneOffsetMinutes,
      maxNudgesPerDay: record.maxNudgesPerDay,
      channels: asCoordinationChannels(record.channels),
    }),
  });
}
