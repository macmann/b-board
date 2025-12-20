import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { jsonError } from "@/lib/apiResponse";
import prisma from "@/lib/db";
import { ensureProjectRole, ForbiddenError } from "@/lib/permissions";
import { IssueType, Role, TestResultStatus } from "@/lib/prismaEnums";
import { logServer } from "@/lib/serverLogger";

const EDIT_ROLES = [Role.ADMIN, Role.PO, Role.QA];

const isValidEnumValue = <T extends string>(value: unknown, values: T[]): value is T => {
  return typeof value === "string" && values.includes(value as T);
};

const normalizeResult = (value: unknown): TestResultStatus | undefined => {
  if (typeof value !== "string") return undefined;

  const normalized = value.replace(/\s+/g, "").replace(/-/g, "").toUpperCase();

  const resultMap: Record<string, TestResultStatus> = {
    PASS: TestResultStatus.PASS,
    FAIL: TestResultStatus.FAIL,
    BLOCKED: TestResultStatus.BLOCKED,
    NOTRUN: TestResultStatus.NOT_RUN,
  };

  return resultMap[normalized];
};

const validateTestCaseProject = async (projectId: string, testCaseId: string) => {
  const testCase = await prisma.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });

  return testCase?.projectId === projectId;
};

const validateSprintProject = async (projectId: string, sprintId: string) => {
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

  return Boolean(issue && issue.projectId === projectId && (!issue.type || issue.type === IssueType.BUG));
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ projectId: string; sprintId: string }> }
) {
  const requestId = randomUUID();
  const { projectId, sprintId } = await context.params;

  logServer(requestId, "SPRINT_EXECUTION_PATCH_REQUEST", {
    method: request.method,
    pathname: request.nextUrl.pathname,
    projectId,
    sprintId,
  });

  if (!projectId || !sprintId) {
    return NextResponse.json(
      { error: "MISSING_PARAMS", message: "projectId and sprintId are required", params: { projectId, sprintId } },
      { status: 422 }
    );
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, EDIT_ROLES);

    if (!(await validateSprintProject(projectId, sprintId))) {
      return jsonError("Invalid sprintId", 400);
    }

    const body = await request.json();
    const {
      testCaseId,
      result,
      executionResult,
      status,
      notes,
      actualResult,
      linkedBugIssueId,
    } = body ?? {};

    const rawResult = result ?? executionResult ?? status;
    const normalizedResult = normalizeResult(rawResult);
    const resolvedResult = normalizedResult ?? TestResultStatus.NOT_RUN;
    const incomingNotes = notes ?? actualResult ?? null;

    logServer(requestId, "SPRINT_EXECUTION_PATCH_BODY", {
      method: request.method,
      pathname: request.nextUrl.pathname,
      projectId,
      sprintId,
      testCaseId,
      result: rawResult,
      body,
    });

    if (!testCaseId || typeof testCaseId !== "string") {
      return jsonError("testCaseId is required", 400);
    }

    if (!(await validateTestCaseProject(projectId, testCaseId))) {
      return jsonError("Invalid testCaseId", 400);
    }

    if (linkedBugIssueId && !(await validateLinkedBug(projectId, linkedBugIssueId))) {
      return jsonError("Invalid linkedBugIssueId", 400);
    }

    if (rawResult !== undefined && !normalizedResult) {
      console.warn("[QA][SprintExecutions][PATCH][Validation]", {
        requestId,
        projectId,
        sprintId,
        testCaseId,
        receivedResult: rawResult,
        allowed: Object.values(TestResultStatus),
      });

      return NextResponse.json(
        {
          error: "INVALID_RESULT",
          message: "Invalid execution result",
          allowed: Object.values(TestResultStatus),
          received: rawResult,
        },
        { status: 422 }
      );
    }

    const executedAt = resolvedResult === TestResultStatus.NOT_RUN ? null : new Date();

    const execution = await prisma.testExecution.upsert({
      where: {
        testCaseId_sprintId: {
          testCaseId,
          sprintId,
        },
      },
      update: {
        result: resolvedResult,
        actualResult: incomingNotes ?? null,
        executedAt,
        linkedBugIssueId: linkedBugIssueId ?? null,
        executedById: user.id,
        updatedAt: new Date(),
      },
      create: {
        testCaseId,
        sprintId,
        result: resolvedResult,
        actualResult: incomingNotes ?? null,
        executedAt,
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

    logServer(requestId, "SPRINT_EXECUTION_PATCH_PRISMA", {
      operation: "testExecution.upsert",
      where: { testCaseId, sprintId },
      result: resolvedResult,
      linkedBugIssueId,
    });

    return NextResponse.json({ ok: true, data: execution });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][SprintExecutions][PATCH]", requestId, error);
    return jsonError("Internal server error", 500);
  }
}
