import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { IssueHistoryField, IssueStatus, Role } from "@/lib/prismaEnums";

const ALL_PROJECTS_VALUE = "all";
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DEFAULT_RANGE_DAYS = 30;

type Completion = {
  issueId: string;
  projectId: string;
  sprintId: string | null;
  storyPoints: number;
  createdAt: Date;
  doneAt: Date;
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  const defaultTo = endOfDay(today);

  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));

  const parsedFrom = parseDateOnly(searchParams.get("from"));
  const parsedTo = parseDateOnly(searchParams.get("to"));

  const from = parsedFrom ? startOfDay(parsedFrom) : defaultFrom;
  const to = parsedTo ? endOfDay(parsedTo) : defaultTo;

  if (to < from) {
    return { from: defaultFrom, to: defaultTo };
  }

  return { from, to };
};

const median = (values: number[]) => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
};

const getAccessibleProjectIds = async (
  user: { id: string; role: Role },
  requestedProjectId: string | null
) => {
  if (user.role === Role.ADMIN || user.role === Role.PO) {
    return requestedProjectId ? [requestedProjectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjects = memberships.map((membership) => membership.projectId);

  if (requestedProjectId) {
    return memberProjects.includes(requestedProjectId)
      ? [requestedProjectId]
      : ([] as string[]);
  }

  return memberProjects;
};

const bucketCompletionsWeekly = (
  completions: Completion[],
  from: Date,
  to: Date
) => {
  const buckets: {
    periodStart: string;
    issuesDone: number;
    pointsDone: number;
  }[] = [];

  const start = startOfDay(from);
  const startDay = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - ((startDay + 6) % 7));

  const cursor = start;
  while (cursor.getTime() <= to.getTime()) {
    const periodStart = startOfDay(cursor);
    const periodEnd = endOfDay(new Date(periodStart));
    periodEnd.setUTCDate(periodEnd.getUTCDate() + 6);

    const weekly = completions.filter(
      (completion) =>
        completion.doneAt >= periodStart && completion.doneAt <= periodEnd
    );

    buckets.push({
      periodStart: periodStart.toISOString().slice(0, 10),
      issuesDone: weekly.length,
      pointsDone: weekly.reduce(
        (total, completion) => total + completion.storyPoints,
        0
      ),
    });

    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return buckets.filter((bucket) => bucket.periodStart <= to.toISOString());
};

const bucketCompletions = (
  completions: Completion[],
  from: Date,
  to: Date
) => {
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  const useDaily = diffDays <= 14;

  const buckets: {
    periodStart: string;
    issuesDone: number;
    pointsDone: number;
  }[] = [];

  if (useDaily) {
    const cursor = startOfDay(from);
    while (cursor.getTime() <= to.getTime()) {
      const periodEnd = endOfDay(cursor);
      const isoDate = cursor.toISOString().slice(0, 10);

      const daily = completions.filter(
        (completion) =>
          completion.doneAt >= cursor && completion.doneAt <= periodEnd
      );

      buckets.push({
        periodStart: isoDate,
        issuesDone: daily.length,
        pointsDone: daily.reduce(
          (total, completion) => total + completion.storyPoints,
          0
        ),
      });

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return buckets;
  }

  return bucketCompletionsWeekly(completions, from, to);
};

const computeWeeklyVolatility = (buckets: { issuesDone: number }[]) => {
  const counts = buckets.map((bucket) => bucket.issuesDone).filter(Boolean);

  if (counts.length === 0) {
    return { volatility: 0, stabilityScore: 0 };
  }

  const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;
  const variance =
    counts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  const volatility = mean === 0 ? 0 : stdDev / mean;
  const stabilityScore = Math.max(
    0,
    Math.min(100, Math.round(100 * (1 - Math.min(volatility, 1))))
  );

  return { volatility, stabilityScore };
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectParam = searchParams.get("projectId");
  const projectId =
    projectParam && projectParam !== ALL_PROJECTS_VALUE ? projectParam : null;

  const accessibleProjects = await getAccessibleProjectIds(user, projectId);

  if (accessibleProjects !== null && accessibleProjects.length === 0) {
    return NextResponse.json({
      completedIssues: 0,
      completedPoints: 0,
      avgLeadTimeDays: null,
      medianLeadTimeDays: null,
      throughputTrend: [],
      predictability: { type: "volatility", stabilityScore: 0, volatility: 0 },
    });
  }

  const { from, to } = buildDateRange(searchParams);

  const doneHistories = await prisma.issueHistory.findMany({
    where: {
      field: IssueHistoryField.STATUS,
      newValue: IssueStatus.DONE,
      createdAt: { gte: from, lte: to },
      issue: {
        ...(accessibleProjects ? { projectId: { in: accessibleProjects } } : {}),
      },
    },
    orderBy: { createdAt: "asc" },
    select: {
      issueId: true,
      createdAt: true,
      issue: {
        select: {
          id: true,
          projectId: true,
          sprintId: true,
          storyPoints: true,
          createdAt: true,
        },
      },
    },
  });

  const fallbackIssues = await prisma.issue.findMany({
    where: {
      status: IssueStatus.DONE,
      updatedAt: { gte: from, lte: to },
      ...(accessibleProjects ? { projectId: { in: accessibleProjects } } : {}),
      history: {
        none: {
          field: IssueHistoryField.STATUS,
          newValue: IssueStatus.DONE,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
      sprintId: true,
      storyPoints: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const doneCompletionMap = new Map<string, (typeof doneHistories)[number]>();

  doneHistories.forEach((entry) => {
    if (!doneCompletionMap.has(entry.issueId)) {
      doneCompletionMap.set(entry.issueId, entry);
    }
  });

  const completions: Completion[] = [
    ...Array.from(doneCompletionMap.values()).map((entry) => ({
      issueId: entry.issueId,
      projectId: entry.issue.projectId,
      sprintId: entry.issue.sprintId,
      storyPoints: entry.issue.storyPoints ?? 0,
      createdAt: entry.issue.createdAt,
      doneAt: entry.createdAt,
    })),
    ...fallbackIssues.map((issue) => ({
      issueId: issue.id,
      projectId: issue.projectId,
      sprintId: issue.sprintId,
      storyPoints: issue.storyPoints ?? 0,
      createdAt: issue.createdAt,
      doneAt: issue.updatedAt,
    })),
  ];

  const completedIssues = completions.length;
  const completedPoints = completions.reduce(
    (sum, completion) => sum + completion.storyPoints,
    0
  );

  const leadTimes = completions.map(
    (completion) => (completion.doneAt.getTime() - completion.createdAt.getTime()) / MS_PER_DAY
  );

  const avgLeadTimeDays = leadTimes.length
    ? leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length
    : null;
  const medianLeadTimeDays = median(leadTimes);

  const throughputTrend = bucketCompletions(completions, from, to);

  const sprints = await prisma.sprint.findMany({
    where: {
      ...(accessibleProjects ? { projectId: { in: accessibleProjects } } : {}),
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: to } }] },
        { OR: [{ endDate: null }, { endDate: { gte: from } }] },
      ],
    },
    select: { id: true, name: true, startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  });

  const predictability = await (async () => {
    if (!sprints.length) {
      const weeklyBuckets = bucketCompletionsWeekly(completions, from, to);
      const { volatility, stabilityScore } = computeWeeklyVolatility(
        weeklyBuckets
      );
      return {
        type: "volatility" as const,
        stabilityScore,
        volatility,
      };
    }

    const sprintIssues = await prisma.issue.findMany({
      where: {
        sprintId: { in: sprints.map((sprint) => sprint.id) },
        ...(accessibleProjects ? { projectId: { in: accessibleProjects } } : {}),
      },
      select: {
        id: true,
        sprintId: true,
        storyPoints: true,
      },
    });

    const completionByIssue = new Map(
      completions.map((completion) => [completion.issueId, completion])
    );

    const sprintSummaries = sprints.map((sprint) => {
      const issues = sprintIssues.filter(
        (issue) => issue.sprintId === sprint.id
      );

      const plannedPoints = issues.reduce(
        (sum, issue) => sum + (issue.storyPoints ?? 0),
        0
      );

      const completedPointsForSprint = issues.reduce((sum, issue) => {
        const completion = completionByIssue.get(issue.id);

        if (!completion) return sum;

        const withinSprintWindow =
          (!sprint.startDate || completion.doneAt >= sprint.startDate) &&
          (!sprint.endDate || completion.doneAt <= sprint.endDate);

        return withinSprintWindow
          ? sum + (issue.storyPoints ?? 0)
          : sum;
      }, 0);

      const completionRatio =
        plannedPoints > 0
          ? Number((completedPointsForSprint / plannedPoints).toFixed(2))
          : null;

      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        plannedPoints,
        completedPoints: completedPointsForSprint,
        completionRatio,
        startDate: sprint.startDate?.toISOString() ?? null,
        endDate: sprint.endDate?.toISOString() ?? null,
      };
    });

    return { type: "sprint" as const, sprints: sprintSummaries };
  })();

  return NextResponse.json({
    completedIssues,
    completedPoints,
    avgLeadTimeDays,
    medianLeadTimeDays,
    throughputTrend,
    predictability,
  });
}
