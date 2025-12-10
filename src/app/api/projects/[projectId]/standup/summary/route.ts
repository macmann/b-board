import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../../lib/auth";
import prisma from "../../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
} from "../../../../../../lib/permissions";
import { resolveProjectId, type ProjectParams } from "../../../../../../lib/params";

const parseDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
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
  const date = parseDate(searchParams.get("date"));
  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate"));

  if (!date && !startDate && !endDate) {
    return NextResponse.json(
      { message: "date or date range is required" },
      { status: 400 }
    );
  }

  const dateFilter = date
    ? date
    : {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };

  const entries = await prisma.dailyStandupEntry.findMany({
    where: {
      projectId,
      date: dateFilter,
    },
    include: {
      issues: { include: { issue: true } },
      user: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: true },
  });

  const summary = members.map((member) => {
    const entriesForUser = entries.filter((entry) => entry.userId === member.userId);
    const latestEntry = entriesForUser[0] ?? null;

    return {
      userId: member.userId,
      name: member.user.name,
      role: member.role,
      status: latestEntry ? "submitted" : "missing",
      isComplete: latestEntry?.isComplete ?? false,
      entryId: latestEntry?.id ?? null,
      date: latestEntry?.date ?? null,
      createdAt: latestEntry?.createdAt ?? null,
      updatedAt: latestEntry?.updatedAt ?? null,
      issues: latestEntry?.issues.map((issue) => issue.issue) ?? [],
    };
  });

  return NextResponse.json({
    date,
    startDate,
    endDate,
    members: summary,
    totalEntries: entries.length,
  });
}
