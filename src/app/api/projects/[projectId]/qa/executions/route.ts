import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
} from "@/lib/permissions";
import { IssueType, Role, TestResultStatus } from "@/lib/prismaEnums";

const VIEW_ROLES = [Role.ADMIN, Role.PO, Role.DEV, Role.QA];
const EDIT_ROLES = [Role.ADMIN, Role.PO, Role.QA];

const isValidEnumValue = <T extends string>(value: unknown, values: T[]): value is T => {
  return typeof value === "string" && values.includes(value as T);
};

const validateTestCaseProject = async (projectId: string, testCaseId: string) => {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });

  return testCase?.projectId === projectId;
};

const validateSprintProject = async (projectId: string, sprintId?: string | null) => {
  if (!sprintId) return true;

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });

  return sprint?.projectId === projectId;
};

const validateLinkedBug = async (projectId: string, linkedBugIssueId?: string | null) => {
  if (!linkedBugIssueId) return true;

  const issue = await prisma.issue.findUnique({
    where: { id: linkedBugIssueId },
    select: { projectId: true, type: true },
  });

  if (!issue || issue.projectId !== projectId) {
    return false;
  }

  if (issue.type && issue.type !== IssueType.BUG) {
    return false;
  }

  return true;
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, VIEW_ROLES);

    const searchParams = request.nextUrl.searchParams;
    const sprintId = searchParams.get("sprintId") ?? undefined;
    const storyIssueId = searchParams.get("storyIssueId") ?? undefined;
    const resultParam = searchParams.get("result") ?? undefined;

    const result = isValidEnumValue(resultParam, Object.values(TestResultStatus))
      ? resultParam
      : undefined;

    const executions = await prisma.testExecution.findMany({
      where: {
        ...(sprintId ? { sprintId } : {}),
        ...(result ? { result } : {}),
        testCase: {
          projectId,
          ...(storyIssueId ? { storyIssueId } : {}),
        },
      },
      include: {
        testCase: true,
        sprint: true,
        linkedBugIssue: true,
        executedBy: true,
      },
      orderBy: [
        { executedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ ok: true, data: executions });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][Executions][GET]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, EDIT_ROLES);

    const body = await request.json();

    const {
      testCaseId,
      sprintId,
      result,
      actualResult,
      executedAt,
      linkedBugIssueId,
    } = body ?? {};

    console.info("[QA][Executions][POST]", {
      requestId: requestId ?? "n/a",
      projectId,
      testCaseId,
      sprintId,
      result,
      userId: user.id,
    });

    if (!testCaseId || typeof testCaseId !== "string") {
      return jsonError("testCaseId is required", 400);
    }

    if (!(await validateTestCaseProject(projectId, testCaseId))) {
      return jsonError("Invalid testCaseId", 400);
    }

    if (!(await validateSprintProject(projectId, sprintId))) {
      return jsonError("Invalid sprintId", 400);
    }

    if (linkedBugIssueId && !(await validateLinkedBug(projectId, linkedBugIssueId))) {
      return jsonError("Invalid linkedBugIssueId", 400);
    }

    const resolvedResult = isValidEnumValue(result, Object.values(TestResultStatus))
      ? result
      : TestResultStatus.NOT_RUN;

    const parsedExecutedAt = executedAt ? new Date(executedAt) : null;

    if (parsedExecutedAt && Number.isNaN(parsedExecutedAt.getTime())) {
      return jsonError("Invalid executedAt", 400);
    }

    const execution = await prisma.testExecution.upsert({
      where: {
        testCaseId_sprintId: {
          testCaseId,
          sprintId: sprintId ?? null,
        },
      },
      update: {
        result: resolvedResult,
        actualResult: actualResult ?? null,
        executedAt: parsedExecutedAt,
        linkedBugIssueId: linkedBugIssueId ?? null,
        executedById: user.id,
        updatedAt: new Date(),
      },
      create: {
        testCaseId,
        sprintId: sprintId ?? null,
        result: resolvedResult,
        actualResult: actualResult ?? null,
        executedAt: parsedExecutedAt,
        linkedBugIssueId: linkedBugIssueId ?? null,
        executedById: user.id,
      },
      include: {
        testCase: true,
        sprint: true,
        linkedBugIssue: true,
        executedBy: true,
      },
    });

    return NextResponse.json({ ok: true, data: execution }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][Executions][POST]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}
