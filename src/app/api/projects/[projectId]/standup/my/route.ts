import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { Role } from "@/lib/prismaEnums";
import { parseDateOnly, parseTimeOnDate } from "@/lib/standupWindow";

const standupInclude = {
  issues: {
    include: { issue: true },
  },
  research: {
    include: { researchItem: true },
  },
};

const computeCompletion = (
  summaryToday?: string | null,
  linkedWorkIds?: (string | undefined)[]
) => {
  return Boolean(summaryToday && summaryToday.trim()) && Boolean(linkedWorkIds?.length);
};

const normalizeIssueIds = (issueIds: unknown): string[] => {
  if (!Array.isArray(issueIds)) return [];
  return Array.from(new Set(issueIds.filter((id): id is string => typeof id === "string")));
};

const normalizeResearchIds = (researchIds: unknown): string[] => {
  if (!Array.isArray(researchIds)) return [];
  return Array.from(
    new Set(researchIds.filter((id): id is string => typeof id === "string"))
  );
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

  const dateParam = request.nextUrl.searchParams.get("date");
  const requestedUserId = request.nextUrl.searchParams.get("userId");
  const date = parseDateOnly(dateParam ?? new Date());

  if (!date) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  const targetUserId =
    requestedUserId && requestedUserId !== user.id ? requestedUserId : user.id;

  if (targetUserId !== user.id) {
    try {
      await ensureProjectRole(prisma, user.id, projectId, [Role.ADMIN]);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      throw error;
    }

    const targetMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
      select: { userId: true },
    });

    if (!targetMember) {
      return NextResponse.json(
        { message: "User is not a project member" },
        { status: 404 }
      );
    }
  }

  const entry = await prisma.dailyStandupEntry.findUnique({
    where: {
      projectId_userId_date: {
        projectId,
        userId: targetUserId,
        date,
      },
    },
    include: standupInclude,
  });

  return NextResponse.json(entry);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  return upsertEntry(request, params);
}

export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  return upsertEntry(request, params);
}

const upsertEntry = async (
  request: NextRequest,
  params: ProjectParams
): Promise<NextResponse> => {
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

  const body = await request.json();

  const {
    date: dateInput,
    userId: requestedUserId,
    yesterdayWork,
    todayPlan,
    summaryToday,
    progressSinceYesterday,
    blockers: blockersInput,
    dependencies,
    notes,
    issueIds: issueIdsInput,
    researchIds: researchIdsInput,
  } = body ?? {};

  const date = parseDateOnly(dateInput ?? new Date());

  if (!date) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  const settings = prisma.projectSettings
    ? await prisma.projectSettings.findUnique({
        where: { projectId },
      })
    : null;

  if (settings?.standupWindowStart && settings?.standupWindowEnd) {
    const now = new Date();
    const windowStart = parseTimeOnDate(date, settings.standupWindowStart);
    const windowEnd = parseTimeOnDate(date, settings.standupWindowEnd);

    if (!windowStart || !windowEnd) {
      return NextResponse.json(
        { message: "Invalid stand-up window configuration" },
        { status: 500 }
      );
    }

    // TODO: align stand-up window comparison with project timezones when available.
    if (now < windowStart || now > windowEnd) {
      return NextResponse.json(
        {
          message: `Stand-up window is from ${settings.standupWindowStart} to ${settings.standupWindowEnd}. Your update is outside this window.`,
        },
        { status: 400 }
      );
    }
  }

  const targetUserId =
    typeof requestedUserId === "string" && requestedUserId !== user.id
      ? requestedUserId
      : user.id;

  if (targetUserId !== user.id) {
    try {
      await ensureProjectRole(prisma, user.id, projectId, [Role.ADMIN]);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      throw error;
    }

    const targetMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
      select: { userId: true },
    });

    if (!targetMember) {
      return NextResponse.json(
        { message: "User is not a project member" },
        { status: 404 }
      );
    }
  }

  const issueIds = normalizeIssueIds(issueIdsInput);
  const researchIds = normalizeResearchIds(researchIdsInput);

  const validIssues = issueIds.length
    ? await prisma.issue.findMany({
        where: { id: { in: issueIds }, projectId },
        select: { id: true },
      })
    : [];

  const validResearchItems = researchIds.length
    ? await prisma.researchItem.findMany({
        where: { id: { in: researchIds }, projectId },
        select: { id: true },
      })
    : [];

  const validIssueIds = validIssues.map((issue) => issue.id);
  const validResearchIds = validResearchItems.map((researchItem) => researchItem.id);
  const normalizedSummaryToday = todayPlan ?? summaryToday;
  const normalizedProgress = yesterdayWork ?? progressSinceYesterday;
  const normalizedBlockers = blockersInput ?? null;
  const isComplete = computeCompletion(normalizedSummaryToday, [
    ...validIssueIds,
    ...validResearchIds,
  ]);

  const entry = await prisma.$transaction(async (tx) => {
    const upserted = await tx.dailyStandupEntry.upsert({
      where: {
        projectId_userId_date: {
          projectId,
          userId: targetUserId,
          date,
        },
      },
      update: {
        summaryToday: normalizedSummaryToday ?? null,
        progressSinceYesterday: normalizedProgress ?? null,
        blockers: normalizedBlockers ?? null,
        dependencies: dependencies ?? null,
        notes: notes ?? null,
        isComplete,
      },
      create: {
        projectId,
        userId: targetUserId,
        date,
        summaryToday: normalizedSummaryToday ?? null,
        progressSinceYesterday: normalizedProgress ?? null,
        blockers: normalizedBlockers ?? null,
        dependencies: dependencies ?? null,
        notes: notes ?? null,
        isComplete,
      },
    });

    await tx.standupAttendance.upsert({
      where: {
        projectId_userId_date: {
          projectId,
          userId: targetUserId,
          date,
        },
      },
      update: { status: "PRESENT" },
      create: {
        projectId,
        userId: targetUserId,
        date,
        status: "PRESENT",
      },
    });

    if (validIssueIds.length) {
      await tx.standupEntryIssueLink.deleteMany({
        where: {
          standupEntryId: upserted.id,
          issueId: { notIn: validIssueIds },
        },
      });
    } else {
      await tx.standupEntryIssueLink.deleteMany({
        where: { standupEntryId: upserted.id },
      });
    }

    if (validResearchIds.length) {
      await tx.standupEntryResearchLink.deleteMany({
        where: {
          standupEntryId: upserted.id,
          researchItemId: { notIn: validResearchIds },
        },
      });
    } else {
      await tx.standupEntryResearchLink.deleteMany({
        where: { standupEntryId: upserted.id },
      });
    }

    if (validIssueIds.length) {
      await tx.standupEntryIssueLink.createMany({
        data: validIssueIds.map((issueId) => ({
          standupEntryId: upserted.id,
          issueId,
        })),
        skipDuplicates: true,
      });
    }

    if (validResearchIds.length) {
      await tx.standupEntryResearchLink.createMany({
        data: validResearchIds.map((researchItemId) => ({
          standupEntryId: upserted.id,
          researchItemId,
        })),
        skipDuplicates: true,
      });
    }

    return upserted;
  });

  const result = await prisma.dailyStandupEntry.findUnique({
    where: { id: entry.id },
    include: standupInclude,
  });

  return NextResponse.json(result, { status: 200 });
};
