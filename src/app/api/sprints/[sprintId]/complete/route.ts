import {
  IssueHistoryField,
  IssueStatus,
  Role,
  SprintStatus,
} from "../../../../../lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import prisma from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/apiResponse";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ sprintId: string }> }
) {
  const { sprintId } = await ctx.params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });

  if (!sprint) {
    return jsonError("Sprint not found", 404);
  }

  try {
    await requireProjectRole(user.id, sprint.projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  if (sprint.status !== SprintStatus.ACTIVE) {
    return jsonError("Only active sprints can be completed", 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedSprint = await tx.sprint.update({
      where: { id: sprint.id },
      data: {
        status: SprintStatus.COMPLETED,
        endDate: sprint.endDate ?? new Date(),
      },
    });

    const incompleteIssues = await tx.issue.findMany({
      where: {
        sprintId: sprint.id,
        status: { not: IssueStatus.DONE },
      },
      select: { id: true },
    });

    if (incompleteIssues.length > 0) {
      const issueIds = incompleteIssues.map((issue) => issue.id);

      await tx.issue.updateMany({
        where: { id: { in: issueIds } },
        data: { sprintId: null },
      });

      await tx.issueHistory.createMany({
        data: incompleteIssues.map((issue) => ({
          issueId: issue.id,
          changedById: user.id,
          field: IssueHistoryField.SPRINT,
          oldValue: sprint.id,
          newValue: null,
        })),
      });
    }

    return updatedSprint;
  });

  return NextResponse.json(result);
}
