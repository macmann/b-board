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

const EDIT_ROLES = [Role.ADMIN, Role.PO, Role.QA];

const isValidEnumValue = <T extends string>(value: unknown, values: T[]): value is T => {
  return typeof value === "string" && values.includes(value as T);
};

const getExecutionWithProject = async (executionId: string) => {
  return prisma.testExecution.findUnique({
    where: { id: executionId },
    include: {
      testCase: {
        select: { projectId: true },
      },
    },
  });
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: ProjectParams & { executionId?: string } }
) {
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);
  const executionId = params && typeof params === "object" ? params.executionId : undefined;

  if (!projectId || !executionId) {
    return jsonError("projectId and executionId are required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, EDIT_ROLES);

    const existing = await getExecutionWithProject(executionId);

    if (!existing || existing.testCase.projectId !== projectId) {
      return jsonError("Test execution not found", 404);
    }

    const body = await request.json();
    const { result, actualResult, executedAt, linkedBugIssueId } = body ?? {};

    console.info("[QA][Executions][PATCH]", {
      requestId: requestId ?? "n/a",
      executionId,
      projectId,
      result,
      executedAt,
    });

    if (linkedBugIssueId && !(await validateLinkedBug(projectId, linkedBugIssueId))) {
      return jsonError("Invalid linkedBugIssueId", 400);
    }

    const resolvedResult = isValidEnumValue(result, Object.values(TestResultStatus))
      ? result
      : undefined;

    if (result !== undefined && !resolvedResult) {
      return jsonError("Invalid result", 400);
    }

    const parsedExecutedAt = executedAt === null ? null : executedAt ? new Date(executedAt) : undefined;

    if (parsedExecutedAt && Number.isNaN(parsedExecutedAt.getTime())) {
      return jsonError("Invalid executedAt", 400);
    }

    const updated = await prisma.testExecution.update({
      where: { id: executionId },
      data: {
        ...(resolvedResult ? { result: resolvedResult } : {}),
        ...(actualResult !== undefined ? { actualResult: actualResult ?? null } : {}),
        ...(parsedExecutedAt !== undefined ? { executedAt: parsedExecutedAt } : {}),
        ...(linkedBugIssueId !== undefined
          ? { linkedBugIssueId: linkedBugIssueId ?? null }
          : {}),
        executedById: user.id,
      },
      include: {
        testCase: true,
        sprint: true,
        linkedBugIssue: true,
        executedBy: true,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][Executions][PATCH]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}
