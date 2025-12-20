import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
} from "@/lib/permissions";
import {
  Role,
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
} from "@/lib/prismaEnums";

const VIEW_ROLES = [Role.ADMIN, Role.PO, Role.DEV, Role.QA];
const EDIT_ROLES = [Role.ADMIN, Role.PO, Role.QA];
const DELETE_ROLES = [Role.ADMIN, Role.PO];

const isValidEnumValue = <T extends string>(value: unknown, values: T[]): value is T => {
  return typeof value === "string" && values.includes(value as T);
};

const getTestCase = async (testCaseId: string) => {
  return prisma.testCase.findUnique({
    where: { id: testCaseId },
  });
};

const validateStoryIssue = async (projectId: string, storyIssueId?: string | null) => {
  if (!storyIssueId) return true;

  const storyIssue = await prisma.issue.findUnique({
    where: { id: storyIssueId },
    select: { projectId: true },
  });

  return Boolean(storyIssue && storyIssue.projectId === projectId);
};

const getLatestExecutionsBySprint = async (testCaseId: string) => {
  const executions = await prisma.testExecution.findMany({
    where: { testCaseId },
    include: {
      sprint: true,
      linkedBugIssue: true,
      executedBy: true,
    },
    orderBy: [
      { executedAt: "desc" },
      { createdAt: "desc" },
    ],
  });

  const latestBySprint = new Map<string | null, typeof executions[number]>();

  for (const execution of executions) {
    if (!latestBySprint.has(execution.sprintId ?? null)) {
      latestBySprint.set(execution.sprintId ?? null, execution);
    }
  }

  return Array.from(latestBySprint.values());
};

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams & { testCaseId?: string } }
) {
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);
  const testCaseId = params && typeof params === "object" ? params.testCaseId : undefined;

  if (!projectId || !testCaseId) {
    return jsonError("projectId and testCaseId are required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, VIEW_ROLES);

    const testCase = await getTestCase(testCaseId);

    if (!testCase || testCase.projectId !== projectId) {
      return jsonError("Test case not found", 404);
    }

    const includeExecutions = request.nextUrl.searchParams.get("includeExecutions") === "true";

    if (!includeExecutions) {
      return NextResponse.json({ ok: true, data: testCase });
    }

    const executions = await getLatestExecutionsBySprint(testCaseId);

    return NextResponse.json({
      ok: true,
      data: {
        ...testCase,
        executions,
      },
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][TestCases][GET_BY_ID]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: ProjectParams & { testCaseId?: string } }
) {
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);
  const testCaseId = params && typeof params === "object" ? params.testCaseId : undefined;

  if (!projectId || !testCaseId) {
    return jsonError("projectId and testCaseId are required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, EDIT_ROLES);

    const existing = await getTestCase(testCaseId);

    if (!existing || existing.projectId !== projectId) {
      return jsonError("Test case not found", 404);
    }

    const body = await request.json();
    const {
      title,
      type,
      scenario,
      testData,
      expectedResult,
      priority,
      status,
      storyIssueId,
    } = body ?? {};

    console.info("[QA][TestCases][PATCH]", {
      requestId: requestId ?? "n/a",
      testCaseId,
      projectId,
      userId: user.id,
      body,
    });

    if (storyIssueId && !(await validateStoryIssue(projectId, storyIssueId))) {
      return jsonError("Invalid storyIssueId", 400);
    }

    const resolvedType = isValidEnumValue(type, Object.values(TestCaseType))
      ? type
      : undefined;
    const resolvedPriority = isValidEnumValue(priority, Object.values(TestCasePriority))
      ? priority
      : undefined;
    const resolvedStatus = isValidEnumValue(status, Object.values(TestCaseStatus))
      ? status
      : undefined;

    if (
      status !== undefined && !resolvedStatus && Object.values(TestCaseStatus).length
    ) {
      return jsonError("Invalid status", 400);
    }

    if (priority !== undefined && !resolvedPriority && Object.values(TestCasePriority).length) {
      return jsonError("Invalid priority", 400);
    }

    const updated = await prisma.testCase.update({
      where: { id: testCaseId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(resolvedType ? { type: resolvedType } : {}),
        ...(storyIssueId !== undefined ? { storyIssueId: storyIssueId ?? null } : {}),
        ...(scenario !== undefined ? { scenario: scenario ?? null } : {}),
        ...(testData !== undefined ? { testData: testData ?? null } : {}),
        ...(expectedResult !== undefined
          ? { expectedResult: expectedResult ?? null }
          : {}),
        ...(priority !== undefined && resolvedPriority ? { priority: resolvedPriority } : {}),
        ...(status !== undefined && resolvedStatus ? { status: resolvedStatus } : {}),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][TestCases][PATCH]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: ProjectParams & { testCaseId?: string } }
) {
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);
  const testCaseId = params && typeof params === "object" ? params.testCaseId : undefined;

  if (!projectId || !testCaseId) {
    return jsonError("projectId and testCaseId are required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, DELETE_ROLES);

    const existing = await getTestCase(testCaseId);

    if (!existing || existing.projectId !== projectId) {
      return jsonError("Test case not found", 404);
    }

    console.info("[QA][TestCases][DELETE]", {
      requestId: requestId ?? "n/a",
      projectId,
      testCaseId,
      userId: user.id,
    });

    await prisma.testCase.delete({ where: { id: testCaseId } });

    return NextResponse.json({ ok: true, data: { id: testCaseId } });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][TestCases][DELETE]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}
