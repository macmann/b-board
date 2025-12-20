import { randomUUID } from "crypto";
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
import { logServer } from "@/lib/serverLogger";

const VIEW_ROLES = [Role.ADMIN, Role.PO, Role.DEV, Role.QA];
const EDIT_ROLES = [Role.ADMIN, Role.PO, Role.QA];
const DELETE_ROLES = [Role.ADMIN, Role.PO];

const isValidEnumValue = <T extends string>(value: unknown, values: T[]): value is T => {
  return typeof value === "string" && values.includes(value as T);
};

const normalizeStatus = (value: unknown): TestCaseStatus | undefined => {
  if (typeof value !== "string") return undefined;

  const normalized = value.replace(/\s+/g, "_").replace(/-/g, "_").toUpperCase();

  const statusMap: Record<string, TestCaseStatus> = {
    DRAFT: TestCaseStatus.DRAFT,
    READY: TestCaseStatus.READY,
    DEPRECATED: TestCaseStatus.DEPRECATED,
  };

  return statusMap[normalized];
};

const normalizePriority = (value: unknown): TestCasePriority | undefined => {
  if (typeof value !== "string") return undefined;

  const normalized = value.toUpperCase();
  const priorityMap: Record<string, TestCasePriority> = {
    LOW: TestCasePriority.LOW,
    MEDIUM: TestCasePriority.MEDIUM,
    HIGH: TestCasePriority.HIGH,
    CRITICAL: TestCasePriority.CRITICAL,
  };

  return priorityMap[normalized];
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
  ctx: { params: Promise<Awaited<ProjectParams> & { testCaseId?: string }> }
) {
  const requestId = randomUUID();
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);
  const testCaseId = params && typeof params === "object" ? params.testCaseId : undefined;

  logServer(requestId, "TEST_CASE_GET_REQUEST", {
    method: request.method,
    pathname: request.nextUrl.pathname,
    params,
    projectId,
    testCaseId,
  });

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

    logServer(requestId, "TEST_CASE_GET_PRISMA", {
      operation: "testCase.findUnique",
      where: { id: testCaseId },
    });

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

    console.error("[QA][TestCases][GET_BY_ID]", requestId, error);
    return jsonError("Internal server error", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams> & { testCaseId?: string }> }
) {
  const requestId = randomUUID();
  const params = await ctx.params;
  const body = await request.json().catch(() => undefined);
  const payload = body && typeof body === "object" ? body : undefined;
  const projectId =
    (await resolveProjectId(params)) ?? (payload?.projectId ? String(payload.projectId) : null);
  const testCaseId = params && typeof params === "object" ? params.testCaseId : undefined;

  console.info(
    JSON.stringify({
      area: "QA",
      event: "TEST_CASE_PARAMS_RESOLVED",
      projectId,
      testCaseId,
    })
  );

  logServer(requestId, "TEST_CASE_PATCH_REQUEST", {
    method: request.method,
    pathname: request.nextUrl.pathname,
    params,
    projectId,
    testCaseId,
    body: payload
      ? {
          ...("storyIssueId" in payload ? { storyIssueId: payload.storyIssueId } : {}),
          ...("status" in payload ? { status: payload.status } : {}),
          ...("priority" in payload ? { priority: payload.priority } : {}),
          ...("title" in payload ? { title: payload.title } : {}),
          ...("type" in payload ? { type: payload.type } : {}),
        }
      : null,
  });

  if (!projectId || !testCaseId) {
    console.warn("[QA][TestCases][PATCH][MissingIds]", {
      requestId,
      params,
      projectId,
      testCaseId,
      body: payload ?? null,
    });

    return NextResponse.json(
      {
        error: "MISSING_IDS",
        message: "projectId and testCaseId are required",
        received: { params: params ?? null, body: payload ?? null },
      },
      { status: 422 }
    );
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

    const {
      title,
      type,
      scenario,
      testData,
      expectedResult,
      priority,
      status,
      readinessStatus,
      readiness,
      state,
      storyIssueId,
    } = payload ?? {};

    const rawStatus = status ?? readinessStatus ?? readiness ?? state;
    const resolvedStatus = normalizeStatus(rawStatus);
    const resolvedPriority = normalizePriority(priority);

    logServer(requestId, "TEST_CASE_PATCH_VALIDATED", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      testCaseId,
      projectId,
      userId: user.id,
      body: payload,
    });

    if (storyIssueId && !(await validateStoryIssue(projectId, storyIssueId))) {
      return jsonError("Invalid storyIssueId", 400);
    }

    const resolvedType = isValidEnumValue(type, Object.values(TestCaseType))
      ? type
      : undefined;

    if (rawStatus !== undefined && !resolvedStatus) {
      console.warn("[QA][TestCases][PATCH][Validation]", {
        requestId,
        projectId,
        testCaseId,
        receivedStatus: rawStatus,
        allowed: Object.values(TestCaseStatus),
      });

      return NextResponse.json(
        {
          error: "INVALID_STATUS",
          message: "Invalid status",
          allowed: Object.values(TestCaseStatus),
          received: rawStatus,
        },
        { status: 422 }
      );
    }

    if (priority !== undefined && !resolvedPriority) {
      console.warn("[QA][TestCases][PATCH][Validation]", {
        requestId,
        projectId,
        testCaseId,
        receivedPriority: priority,
        allowed: Object.values(TestCasePriority),
      });

      return NextResponse.json(
        {
          error: "INVALID_PRIORITY",
          message: "Invalid priority",
          allowed: Object.values(TestCasePriority),
          received: priority,
        },
        { status: 422 }
      );
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
        ...(rawStatus !== undefined && resolvedStatus ? { status: resolvedStatus } : {}),
      },
    });

    logServer(requestId, "TEST_CASE_PATCH_PRISMA", {
      operation: "testCase.update",
      where: { id: testCaseId },
      dataKeys: Object.keys({
        ...(title !== undefined ? { title } : {}),
        ...(resolvedType ? { type: resolvedType } : {}),
        ...(storyIssueId !== undefined ? { storyIssueId: storyIssueId ?? null } : {}),
        ...(scenario !== undefined ? { scenario: scenario ?? null } : {}),
        ...(testData !== undefined ? { testData: testData ?? null } : {}),
        ...(expectedResult !== undefined ? { expectedResult: expectedResult ?? null } : {}),
        ...(priority !== undefined && resolvedPriority ? { priority: resolvedPriority } : {}),
        ...(rawStatus !== undefined && resolvedStatus ? { status: resolvedStatus } : {}),
      }),
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][TestCases][PATCH]", requestId, error);
    return jsonError("Internal server error", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams> & { testCaseId?: string }> }
) {
  const requestId = randomUUID();
  const params = await ctx.params;
  const body = await request.json().catch(() => undefined);
  const payload = body && typeof body === "object" ? body : undefined;
  const projectId =
    (await resolveProjectId(params)) ?? (payload?.projectId ? String(payload.projectId) : null);
  const testCaseId = params && typeof params === "object" ? params.testCaseId : undefined;

  console.info(
    JSON.stringify({
      area: "QA",
      event: "TEST_CASE_PARAMS_RESOLVED",
      projectId,
      testCaseId,
    })
  );

  logServer(requestId, "TEST_CASE_DELETE_REQUEST", {
    method: request.method,
    pathname: request.nextUrl.pathname,
    params,
    projectId,
    testCaseId,
    body: payload ? { testCaseId: payload.testCaseId, projectId: payload.projectId } : null,
  });

  if (!projectId || !testCaseId) {
    console.warn("[QA][TestCases][DELETE][MissingIds]", {
      requestId,
      params,
      projectId,
      testCaseId,
      body: payload ?? null,
    });

    return NextResponse.json(
      {
        error: "MISSING_IDS",
        message: "projectId and testCaseId are required",
        received: { params: params ?? null, body: payload ?? null },
      },
      { status: 422 }
    );
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

    logServer(requestId, "TEST_CASE_DELETE_PRISMA", {
      operation: "testCase.delete",
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

    console.error("[QA][TestCases][DELETE]", requestId, error);
    return jsonError("Internal server error", 500);
  }
}
