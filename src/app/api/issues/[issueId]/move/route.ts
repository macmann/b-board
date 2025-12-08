import { IssueHistoryField, IssueStatus } from "@prisma/client";
import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "../../../../../lib/apiResponse";
import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { recalculatePositions } from "../../../../../lib/issuePosition";
import { logError } from "../../../../../lib/logger";
import {
  AuthorizationError,
  PROJECT_CONTRIBUTOR_ROLES,
  requireProjectRole,
} from "../../../../../lib/permissions";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { issueId: string } }
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const issue = await prisma.issue.findUnique({
      where: { id: params.issueId },
    });

    if (!issue) {
      return jsonError("Issue not found", 404);
    }

    const body = await request.json();
    const { sprintId, status, newIndex } = body as {
      sprintId?: string;
      status?: IssueStatus;
      newIndex?: number;
    };

    if (!sprintId) {
      return jsonError("sprintId is required", 400);
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true },
    });

    if (!sprint || sprint.projectId !== issue.projectId) {
      return jsonError("Sprint not found for this project", 404);
    }

    if (issue.sprintId !== sprintId) {
      return jsonError("Issue does not belong to this sprint", 400);
    }

    const targetStatus = Object.values(IssueStatus).includes(status as IssueStatus)
      ? (status as IssueStatus)
      : null;

    if (!targetStatus) {
      return jsonError("Invalid status", 400);
    }

    if (typeof newIndex !== "number" || Number.isNaN(newIndex)) {
      return jsonError("newIndex must be a number", 400);
    }

    try {
      await requireProjectRole(user.id, sprint.projectId, PROJECT_CONTRIBUTOR_ROLES);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    const issuesInTargetStatus = await prisma.issue.findMany({
      where: { sprintId, status: targetStatus },
      orderBy: { position: "asc" },
      select: { id: true },
    });

    const filteredIssues = issuesInTargetStatus.filter(
      (item) => item.id !== issue.id
    );
    const insertionIndex = Math.max(
      0,
      Math.min(filteredIssues.length, Math.floor(newIndex))
    );
    filteredIssues.splice(insertionIndex, 0, { id: issue.id });

    const updatedPositions = recalculatePositions(filteredIssues);
    const statusChanged = issue.status !== targetStatus;

    const { updatedIssue } = await prisma.$transaction(async (tx) => {
      for (const { id, position } of updatedPositions) {
        const data: Record<string, any> = { position };

        if (id === issue.id) {
          data.status = targetStatus;
          data.sprintId = sprintId;
        }

        await tx.issue.update({
          where: { id },
          data,
        });
      }

      if (statusChanged) {
        await tx.issueHistory.create({
          data: {
            issueId: issue.id,
            changedById: user.id,
            field: IssueHistoryField.STATUS,
            oldValue: issue.status,
            newValue: targetStatus,
          },
        });
      }

      const refreshedIssue = await tx.issue.findUnique({
        where: { id: issue.id },
        include: {
          project: true,
          sprint: true,
          epic: true,
          assignee: true,
          reporter: true,
        },
      });

      return { updatedIssue: refreshedIssue! };
    });

    return jsonOk({ issue: updatedIssue, positions: updatedPositions });
  } catch (error) {
    logError("Failed to move issue", error);
    return jsonError("Something went wrong", 500);
  }
}
