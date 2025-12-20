import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "../../../../../lib/apiResponse";
import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { logError } from "../../../../../lib/logger";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import { PROJECT_ADMIN_ROLES } from "../../../../../lib/roles";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });

    if (!issue) {
      return jsonError("Issue not found", 404);
    }

    const body = await request.json();
    const { toSprintId, toContainer, newIndex, orderedIdsInTargetContainer } = body as {
      toSprintId?: string | null;
      toContainer?: "backlog" | "sprint";
      newIndex?: number;
      orderedIdsInTargetContainer?: string[];
    };

    if (!toContainer || !["backlog", "sprint"].includes(toContainer)) {
      return jsonError("Invalid target container", 400);
    }

    const targetSprintId = toContainer === "sprint" ? toSprintId ?? null : null;

    if (toContainer === "sprint" && !targetSprintId) {
      return jsonError("toSprintId is required when moving to a sprint", 400);
    }

    if (toContainer === "sprint") {
      const sprint = await prisma.sprint.findUnique({
        where: { id: targetSprintId! },
        select: { projectId: true },
      });

      if (!sprint || sprint.projectId !== issue.projectId) {
        return jsonError("Sprint not found for this project", 404);
      }
    }

    try {
      await requireProjectRole(user.id, issue.projectId, PROJECT_ADMIN_ROLES);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    const targetIssues = await prisma.issue.findMany({
      where: { projectId: issue.projectId, sprintId: targetSprintId },
      select: { id: true },
      orderBy: { position: "asc" },
    });

    const providedOrder = Array.isArray(orderedIdsInTargetContainer)
      ? orderedIdsInTargetContainer.filter((id): id is string => Boolean(id))
      : [];

    let finalOrder = providedOrder.filter(
      (id) => id === issueId || targetIssues.some((target) => target.id === id)
    );

    const insertionIndex = Math.max(
      0,
      Math.min(
        typeof newIndex === "number" && !Number.isNaN(newIndex)
          ? Math.floor(newIndex)
          : finalOrder.length,
        finalOrder.length
      )
    );

    if (!finalOrder.includes(issueId)) {
      finalOrder.splice(insertionIndex, 0, issueId);
    }

    const missingTargetIssues = targetIssues
      .map((target) => target.id)
      .filter((id) => !finalOrder.includes(id) && id !== issueId);

    finalOrder = [...finalOrder, ...missingTargetIssues];

    const updatedPositions = finalOrder.map((id, index) => ({
      id,
      position: (index + 1) * 1000,
    }));

    const updatedIssue = await prisma.$transaction(async (tx) => {
      for (const { id, position } of updatedPositions) {
        const data: Record<string, any> = { position };

        if (id === issueId) {
          data.sprintId = targetSprintId;
        }

        await tx.issue.update({
          where: { id },
          data,
        });
      }

      return tx.issue.findUnique({
        where: { id: issueId },
        include: {
          project: true,
          sprint: true,
          epic: true,
          assignee: true,
          reporter: true,
        },
      });
    });

    return jsonOk({
      issue: updatedIssue,
      positions: updatedPositions,
    });
  } catch (error) {
    logError("Failed to move issue", error);
    return jsonError("Something went wrong", 500);
  }
}
