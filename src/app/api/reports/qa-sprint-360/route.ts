import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { IssueStatus, IssueType, Role, TestResultStatus } from "@/lib/prismaEnums";

const DEFAULT_RANGE_DAYS = 30;

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

const getDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  const defaultTo = endOfDay(today);
  const parsedTo = parseDateOnly(searchParams.get("to"));
  const parsedFrom = parseDateOnly(searchParams.get("from"));

  const to = parsedTo ? endOfDay(parsedTo) : defaultTo;
  const from = parsedFrom
    ? startOfDay(parsedFrom)
    : startOfDay(new Date(defaultTo.getTime() - (DEFAULT_RANGE_DAYS - 1) * 24 * 60 * 60 * 1000));

  if (to < from) {
    return { from, to: defaultTo };
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

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id");
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const requestedProjectId = searchParams.get("projectId");
    const projectId = requestedProjectId === "all" ? null : requestedProjectId;
    const { from, to } = getDateRange(searchParams);

    const accessibleProjects = await getAccessibleProjectIds(user, projectId);

    if (Array.isArray(accessibleProjects) && accessibleProjects.length === 0) {
      return NextResponse.json({ ok: false, message: "No access to requested project" }, { status: 403 });
    }

    const projectFilter = projectId
      ? { id: projectId }
      : accessibleProjects
        ? { id: { in: accessibleProjects } }
        : {};

    const projects = await prisma.project.findMany({
      where: projectFilter,
      select: { id: true, name: true, key: true },
    });

    if (projects.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const candidateSprints = await prisma.sprint.findMany({
      where: {
        projectId: { in: projects.map((project) => project.id) },
        OR: [
          { startDate: { gte: from, lte: to } },
          { endDate: { gte: from, lte: to } },
          { AND: [{ startDate: { lte: to } }, { endDate: { gte: from } }] },
          { startDate: null, endDate: null, createdAt: { gte: from, lte: to } },
        ],
      },
      orderBy: [
        { endDate: "desc" },
        { startDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    const latestSprintByProject = new Map<string, typeof candidateSprints[number]>();

    for (const sprint of candidateSprints) {
      if (!latestSprintByProject.has(sprint.projectId)) {
        latestSprintByProject.set(sprint.projectId, sprint);
      }
    }

    const summaries = await Promise.all(
      projects.map(async (project) => {
        const sprint = latestSprintByProject.get(project.id);
        if (!sprint) return null;

        const stories = await prisma.issue.findMany({
          where: {
            projectId: project.id,
            sprintId: sprint.id,
            type: IssueType.STORY,
          },
          select: { id: true },
        });

        const storyIds = stories.map((story) => story.id);

        const testCases = await prisma.testCase.findMany({
          where: {
            projectId: project.id,
            storyIssueId: { in: storyIds },
          },
          select: { id: true },
        });

        const testCaseIds = testCases.map((testCase) => testCase.id);

        const executions = testCaseIds.length
          ? await prisma.testExecution.findMany({
              where: {
                testCaseId: { in: testCaseIds },
                sprintId: sprint.id,
              },
              orderBy: [
                { executedAt: "desc" },
                { createdAt: "desc" },
              ],
            })
          : [];

        const latestExecutionByTestCase = new Map<string, typeof executions[number]>();

        for (const execution of executions) {
          if (!latestExecutionByTestCase.has(execution.testCaseId)) {
            latestExecutionByTestCase.set(execution.testCaseId, execution);
          }
        }

        const breakdown: Record<TestResultStatus, number> = {
          [TestResultStatus.PASS]: 0,
          [TestResultStatus.FAIL]: 0,
          [TestResultStatus.BLOCKED]: 0,
          [TestResultStatus.NOT_RUN]: 0,
        };

        for (const testCaseId of testCaseIds) {
          const execution = latestExecutionByTestCase.get(testCaseId);
          const result = execution?.result ?? TestResultStatus.NOT_RUN;
          breakdown[result] += 1;
        }

        const qaCompletionRate = testCaseIds.length
          ? breakdown[TestResultStatus.PASS] / testCaseIds.length
          : 0;

        const failedBugIds = Array.from(latestExecutionByTestCase.values())
          .filter(
            (execution) =>
              execution.result === TestResultStatus.FAIL && execution.linkedBugIssueId
          )
          .map((execution) => execution.linkedBugIssueId as string);

        const uniqueBugIds = [...new Set(failedBugIds)];

        const bugs = uniqueBugIds.length
          ? await prisma.issue.findMany({
              where: {
                id: { in: uniqueBugIds },
                status: { not: IssueStatus.DONE },
                type: IssueType.BUG,
              },
              select: { id: true, key: true, title: true, status: true },
            })
          : [];

        return {
          projectId: project.id,
          projectName: project.name,
          projectKey: project.key,
          sprint: {
            id: sprint.id,
            name: sprint.name,
            startDate: sprint.startDate,
            endDate: sprint.endDate,
          },
          storyCount: stories.length,
          testCaseCount: testCaseIds.length,
          executionBreakdown: breakdown,
          qaCompletionRate,
          qaCompletionBasis: "Pass rate across linked test cases",
          openBugs: bugs,
        };
      })
    );

    const data = summaries.filter((summary): summary is NonNullable<typeof summary> => Boolean(summary));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[Reports][QA Sprint 360][GET]", requestId ?? "n/a", error);
    return NextResponse.json({ ok: false, message: "Failed to load QA Sprint 360 report" }, { status: 500 });
  }
}
