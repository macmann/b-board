import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { parseDateOnly } from "@/lib/standupWindow";

const standupInclude = {
  issues: { include: { issue: true } },
  research: { include: { researchItem: true } },
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
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const searchParams = request.nextUrl.searchParams;
  const targetUserId = searchParams.get("userId");
  const dateParam = searchParams.get("date");
  const todayDate = parseDateOnly(dateParam ?? new Date());

  if (!targetUserId) {
    return NextResponse.json({ message: "userId is required" }, { status: 400 });
  }

  if (!todayDate) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUserId } },
    include: { user: true },
  });

  if (!membership) {
    return NextResponse.json({ message: "User not found in project" }, { status: 404 });
  }

  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  const [todayEntries, yesterdayEntries] = await Promise.all([
    prisma.dailyStandupEntry.findMany({
      where: { projectId, userId: targetUserId, date: todayDate },
      include: standupInclude,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.dailyStandupEntry.findMany({
      where: { projectId, userId: targetUserId, date: yesterdayDate },
      include: standupInclude,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    user: {
      id: membership.user.id,
      name: membership.user.name,
      avatarUrl: membership.user.avatarUrl,
    },
    today: todayEntries,
    yesterday: yesterdayEntries,
  });
}
