import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { jsonError } from "@/lib/apiResponse";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
} from "@/lib/permissions";
import { IssueType, Role } from "@/lib/prismaEnums";

const VIEW_ROLES = [Role.ADMIN, Role.PO, Role.DEV, Role.QA];

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const sprintId = request.nextUrl.searchParams.get("sprintId");

  if (!sprintId) {
    return jsonError("sprintId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, VIEW_ROLES);

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
        projectId: true,
      },
    });

    if (!sprint || sprint.projectId !== projectId) {
      return jsonError("Sprint not found", 404);
    }

    const stories = await prisma.issue.findMany({
      where: {
        projectId,
        sprintId,
        type: IssueType.STORY,
      },
      select: {
        id: true,
        key: true,
        title: true,
        status: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const storyIds = stories.map((story) => story.id);

    const testCases = await prisma.testCase.findMany({
      where: {
        projectId,
        OR: [
          { storyIssueId: { in: storyIds } },
          { storyIssueId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    const testCaseIds = testCases.map((testCase) => testCase.id);

    const executions = testCaseIds.length
      ? await prisma.testExecution.findMany({
          where: {
            testCaseId: { in: testCaseIds },
            sprintId,
          },
          orderBy: [
            { executedAt: "desc" },
            { createdAt: "desc" },
          ],
          include: {
            linkedBugIssue: {
              select: {
                id: true,
                key: true,
                title: true,
              },
            },
          },
        })
      : [];

    const latestExecutions = executions.reduce<Record<string, typeof executions[number]>>(
      (acc, execution) => {
        if (!acc[execution.testCaseId]) {
          acc[execution.testCaseId] = execution;
        }

        return acc;
      },
      {}
    );

    return NextResponse.json({
      ok: true,
      data: {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          status: sprint.status,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
        },
        stories: stories.map((story) => ({
          issue: story,
          testCases: testCases.filter((testCase) => testCase.storyIssueId === story.id),
        })),
        unlinkedTestCases: testCases.filter((testCase) => !testCase.storyIssueId),
        executions: latestExecutions,
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][Sprint360][GET]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}
