import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { jsonError } from "@/lib/apiResponse";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { ensureProjectRole, ForbiddenError } from "@/lib/permissions";
import { IssueType, Role, TestResultStatus } from "@/lib/prismaEnums";

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
  { params }: { params: ProjectParams & { sprintId?: string } }
) {
  const requestId = request.headers.get("x-request-id") ?? "n/a";
  const projectId = await resolveProjectId(params);
  const sprintId = params?.sprintId;

  if (!projectId || !sprintId) {
    return jsonError("projectId and sprintId are required", 400);
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
    const { testCaseId, result, notes, linkedBugIssueId } = body ?? {};

    console.info("[QA][SprintExecutions][PATCH]", {
      requestId,
      projectId,
      sprintId,
      testCaseId,
      result,
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

    const resolvedResult = isValidEnumValue(result, Object.values(TestResultStatus))
      ? result
      : TestResultStatus.NOT_RUN;

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
        actualResult: notes ?? null,
        executedAt,
        linkedBugIssueId: linkedBugIssueId ?? null,
        executedById: user.id,
        updatedAt: new Date(),
      },
      create: {
        testCaseId,
        sprintId,
        result: resolvedResult,
        actualResult: notes ?? null,
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

    return NextResponse.json({ ok: true, data: execution });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][SprintExecutions][PATCH]", requestId, error);
    return jsonError("Internal server error", 500);
  }
}
