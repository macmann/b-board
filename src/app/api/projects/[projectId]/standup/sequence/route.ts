import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { ProjectParams, resolveProjectId } from "@/lib/params";
import {
  ForbiddenError,
  ensureProjectRole,
  PROJECT_ADMIN_ROLES,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";

const parseSequence = (value: string | null | undefined): string[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
    select: { standupSequence: true },
  });

  return NextResponse.json({
    sequenceUserIds: parseSequence(settings?.standupSequence),
  });
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const body = await request.json().catch(() => null);
  const sequenceUserIds = body?.sequenceUserIds;

  if (!Array.isArray(sequenceUserIds)) {
    return NextResponse.json(
      { message: "sequenceUserIds must be an array of user ids" },
      { status: 400 }
    );
  }

  const normalized = sequenceUserIds.filter(
    (item: unknown): item is string => typeof item === "string" && item.trim().length > 0
  );

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { userId: true },
  });
  const memberIds = new Set(members.map((member) => member.userId));

  if (!normalized.every((userId) => memberIds.has(userId))) {
    return NextResponse.json(
      { message: "sequenceUserIds must contain only project members" },
      { status: 400 }
    );
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const userId of normalized) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    deduped.push(userId);
  }

  const updated = await prisma.projectSettings.upsert({
    where: { projectId },
    update: {
      standupSequence: JSON.stringify(deduped),
    },
    create: {
      projectId,
      standupSequence: JSON.stringify(deduped),
    },
    select: {
      standupSequence: true,
    },
  });

  return NextResponse.json({
    sequenceUserIds: parseSequence(updated.standupSequence),
  });
}
