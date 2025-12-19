import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { IssueStatus, IssueType, Role } from "@/lib/prismaEnums";

type IssueSample = {
  id: string;
  key: string | null;
  title: string;
  status: IssueStatus;
  type: IssueType;
  projectId: string;
  projectName: string;
  updatedAt: string;
};

type StandupSample = {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  userName: string;
  summary: string | null;
};

type OrphanedWorkResponse = {
  counts: {
    unassigned: number;
    missingEpic: number;
    unsprintedActive: number;
    unlinkedStandups: number;
  };
  samples: {
    unassigned: IssueSample[];
    missingEpic: IssueSample[];
    unsprintedActive: IssueSample[];
    unlinkedStandups: StandupSample[];
  };
};

const DEFAULT_RANGE_DAYS = 30;
const SAMPLE_LIMIT = 20;

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setUTCHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (value: Date) => {
  const next = new Date(value);
  next.setUTCHours(23, 59, 59, 999);
  return next;
};

const buildDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  const parsedFrom = parseDateOnly(searchParams.get("from"));
  const parsedTo = parseDateOnly(searchParams.get("to"));

  const to = endOfDay(parsedTo ?? today);
  const defaultFrom = startOfDay(new Date(to));
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));

  const from = startOfDay(parsedFrom ?? defaultFrom);

  if (to < from) {
    return { from: defaultFrom, to: endOfDay(today) };
  }

  return { from, to };
};

const getAccessibleProjectIds = async (
  user: { id: string; role: Role },
  projectId: string | null
) => {
  const leadershipRoles = new Set<Role>([Role.ADMIN, Role.PO]);

  if (leadershipRoles.has(user.role)) {
    return projectId ? [projectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjectIds = memberships.map((membership) => membership.projectId);

  if (projectId) {
    return memberProjectIds.includes(projectId) ? [projectId] : ([] as string[]);
  }

  return memberProjectIds;
};

const issueSelection = {
  id: true,
  key: true,
  title: true,
  status: true,
  type: true,
  projectId: true,
  updatedAt: true,
  project: { select: { name: true } },
} as const;

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedProject = searchParams.get("projectId");
  const projectId = requestedProject && requestedProject !== "all" ? requestedProject : null;
  const { from, to } = buildDateRange(searchParams);

  const accessibleProjects = await getAccessibleProjectIds(user, projectId);

  if (Array.isArray(accessibleProjects) && accessibleProjects.length === 0) {
    return NextResponse.json({ message: "No access to requested project" }, { status: 403 });
  }

  const projectScope = projectId
    ? { projectId }
    : accessibleProjects
      ? { projectId: { in: accessibleProjects } }
      : {};

  const dateScope = { gte: from, lte: to } as const;

  const [unassignedCount, unassignedSamples] = await Promise.all([
    prisma.issue.count({
      where: {
        ...projectScope,
        assigneeId: null,
        status: { not: IssueStatus.DONE },
        updatedAt: dateScope,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectScope,
        assigneeId: null,
        status: { not: IssueStatus.DONE },
        updatedAt: dateScope,
      },
      orderBy: { updatedAt: "desc" },
      take: SAMPLE_LIMIT,
      select: issueSelection,
    }),
  ]);

  const [missingEpicCount, missingEpicSamples] = await Promise.all([
    prisma.issue.count({
      where: {
        ...projectScope,
        type: IssueType.STORY,
        epicId: null,
        status: { not: IssueStatus.DONE },
        updatedAt: dateScope,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectScope,
        type: IssueType.STORY,
        epicId: null,
        status: { not: IssueStatus.DONE },
        updatedAt: dateScope,
      },
      orderBy: { updatedAt: "desc" },
      take: SAMPLE_LIMIT,
      select: issueSelection,
    }),
  ]);

  const [unsprintedCount, unsprintedSamples] = await Promise.all([
    prisma.issue.count({
      where: {
        ...projectScope,
        sprintId: null,
        status: { in: [IssueStatus.IN_PROGRESS, IssueStatus.IN_REVIEW] },
        updatedAt: dateScope,
      },
    }),
    prisma.issue.findMany({
      where: {
        ...projectScope,
        sprintId: null,
        status: { in: [IssueStatus.IN_PROGRESS, IssueStatus.IN_REVIEW] },
        updatedAt: dateScope,
      },
      orderBy: { updatedAt: "desc" },
      take: SAMPLE_LIMIT,
      select: issueSelection,
    }),
  ]);

  const [unlinkedStandupCount, unlinkedStandupSamples] = await Promise.all([
    prisma.dailyStandupEntry.count({
      where: {
        ...projectScope,
        date: dateScope,
        issues: { none: {} },
        research: { none: {} },
      },
    }),
    prisma.dailyStandupEntry.findMany({
      where: {
        ...projectScope,
        date: dateScope,
        issues: { none: {} },
        research: { none: {} },
      },
      orderBy: { date: "desc" },
      take: SAMPLE_LIMIT,
      select: {
        id: true,
        date: true,
        projectId: true,
        summaryToday: true,
        progressSinceYesterday: true,
        notes: true,
        user: { select: { name: true, email: true } },
        project: { select: { name: true } },
      },
    }),
  ]);

  const mapIssueSamples = (issues: typeof unassignedSamples): IssueSample[] =>
    issues.map((issue) => ({
      id: issue.id,
      key: issue.key ?? null,
      title: issue.title,
      status: issue.status,
      type: issue.type,
      projectId: issue.projectId,
      projectName: issue.project?.name ?? "Unknown project",
      updatedAt: issue.updatedAt.toISOString(),
    }));

  const standupSamples: StandupSample[] = unlinkedStandupSamples.map((entry) => ({
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    projectId: entry.projectId,
    projectName: entry.project?.name ?? "Unknown project",
    userName: entry.user?.name || entry.user?.email || "Unknown user",
    summary: entry.summaryToday ?? entry.progressSinceYesterday ?? entry.notes ?? null,
  }));

  const response: OrphanedWorkResponse = {
    counts: {
      unassigned: unassignedCount,
      missingEpic: missingEpicCount,
      unsprintedActive: unsprintedCount,
      unlinkedStandups: unlinkedStandupCount,
    },
    samples: {
      unassigned: mapIssueSamples(unassignedSamples),
      missingEpic: mapIssueSamples(missingEpicSamples),
      unsprintedActive: mapIssueSamples(unsprintedSamples),
      unlinkedStandups: standupSamples,
    },
  };

  return NextResponse.json(response);
}
