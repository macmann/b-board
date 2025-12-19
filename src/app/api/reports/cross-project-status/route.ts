import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { IssueStatus, Role } from "@/lib/prismaEnums";

type CountsByStatus = Record<(typeof IssueStatus)[keyof typeof IssueStatus], number>;

type CrossProjectStatusResponse = {
  totalsByStatus: CountsByStatus;
  projects: Array<{
    projectId: string;
    projectName: string;
    countsByStatus: CountsByStatus;
  }>;
};

const DEFAULT_RANGE_DAYS = 30;

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (value: Date) => {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  const parsedFrom = parseDateOnly(searchParams.get("from"));
  const parsedTo = parseDateOnly(searchParams.get("to"));

  const to = endOfDay(parsedTo ?? today);
  const defaultFrom = startOfDay(new Date(to));
  defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_RANGE_DAYS);

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
    if (!memberProjectIds.includes(projectId)) {
      return [] as string[];
    }
    return [projectId];
  }

  return memberProjectIds;
};

const buildEmptyCounts = (): CountsByStatus => ({
  [IssueStatus.TODO]: 0,
  [IssueStatus.IN_PROGRESS]: 0,
  [IssueStatus.IN_REVIEW]: 0,
  [IssueStatus.DONE]: 0,
});

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedProjectId = searchParams.get("projectId");
  const projectId = requestedProjectId === "all" ? null : requestedProjectId;
  const { from, to } = getDateRange(searchParams);

  const accessibleProjects = await getAccessibleProjectIds(user, projectId);

  if (Array.isArray(accessibleProjects) && accessibleProjects.length === 0) {
    return NextResponse.json({ ok: false, message: "No access to requested project" }, { status: 403 });
  }

  const projectScope = projectId
    ? { projectId }
    : accessibleProjects
      ? { projectId: { in: accessibleProjects } }
      : {};

  const groupedIssues = await prisma.issue.groupBy({
    by: ["projectId", "status"],
    where: {
      createdAt: { lte: to },
      updatedAt: { gte: from, lte: to },
      ...projectScope,
    },
    _count: { _all: true },
  });

  if (groupedIssues.length === 0) {
    const emptyResponse: CrossProjectStatusResponse = {
      totalsByStatus: buildEmptyCounts(),
      projects: [],
    };
    return NextResponse.json(emptyResponse);
  }

  const projectIds = [...new Set(groupedIssues.map((group) => group.projectId))];
  const projects = await prisma.project.findMany({
    where: { id: { in: projectIds } },
    select: { id: true, name: true },
  });

  const projectNameMap = projects.reduce((map, project) => {
    map.set(project.id, project.name);
    return map;
  }, new Map<string, string>());

  const totalsByStatus = groupedIssues.reduce((totals, group) => {
    totals[group.status] = (totals[group.status] ?? 0) + group._count._all;
    return totals;
  }, buildEmptyCounts());

  const projectsById = groupedIssues.reduce((map, group) => {
    const existing = map.get(group.projectId) ?? {
      projectId: group.projectId,
      projectName: projectNameMap.get(group.projectId) ?? "Unknown project",
      countsByStatus: buildEmptyCounts(),
    };

    existing.countsByStatus[group.status] =
      (existing.countsByStatus[group.status] ?? 0) + group._count._all;

    map.set(group.projectId, existing);
    return map;
  }, new Map<string, CrossProjectStatusResponse["projects"][number]>());

  const response: CrossProjectStatusResponse = {
    totalsByStatus,
    projects: Array.from(projectsById.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName)
    ),
  };

  return NextResponse.json(response);
}
