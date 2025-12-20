import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import { resolveProjectId } from "@/lib/params";
import {
  AuthorizationError,
  requireProjectRole,
} from "@/lib/permissions";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";
import {
  AISuggestionStatus,
  AuditActorType,
  AuditEntityType,
  Role,
} from "@/lib/prismaEnums";
import { safeLogAudit } from "@/lib/auditLogger";
import { logError } from "@/lib/logger";

const ALLOWED_SNOOZE_DAYS = new Set([7, 14, 30]);

type DecisionAction = "ACCEPT" | "REJECT" | "SNOOZE";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string; suggestionId: string }> }
) {
  const resolvedParams = await ctx.params;

  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(resolvedParams);
    const suggestionId = resolvedParams.suggestionId;

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    setRequestContextUser(user.id, [user.role]);

    try {
      await requireProjectRole(user.id, projectId, [
        Role.ADMIN,
        Role.PO,
        Role.DEV,
        Role.QA,
        Role.VIEWER,
      ]);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    const suggestion = await prisma.aISuggestion.findFirst({
      where: { id: suggestionId, projectId },
    });

    if (!suggestion) {
      return jsonError("Suggestion not found", 404);
    }

    const body = (await request.json()) as { action?: DecisionAction; snoozeDays?: number };

    if (!body.action || !["ACCEPT", "REJECT", "SNOOZE"].includes(body.action)) {
      return jsonError("Invalid action", 400);
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      decidedByUserId: user.id,
      decidedAt: now,
      snoozedUntil: null,
    };

    if (body.action === "ACCEPT") {
      updateData.status = AISuggestionStatus.ACCEPTED;
    } else if (body.action === "REJECT") {
      updateData.status = AISuggestionStatus.REJECTED;
    } else {
      if (!ALLOWED_SNOOZE_DAYS.has(body.snoozeDays ?? 0)) {
        return jsonError("snoozeDays must be one of 7, 14, or 30", 400);
      }

      updateData.status = AISuggestionStatus.SNOOZED;
      updateData.snoozedUntil = new Date(
        now.getTime() + (body.snoozeDays as number) * 24 * 60 * 60 * 1000
      );
    }

    const updated = await prisma.aISuggestion.update({
      where: { id: suggestion.id },
      data: updateData,
    });

    try {
      const actionSummary: Record<DecisionAction, string> = {
        ACCEPT: "accepted",
        REJECT: "rejected",
        SNOOZE: "snoozed",
      };

      await safeLogAudit({
        projectId,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: `AI_SUGGESTION_${body.action}`,
        entityType: AuditEntityType.AI_SUGGESTION,
        entityId: suggestion.id,
        summary: `User ${actionSummary[body.action]} AI suggestion`,
        before: suggestion,
        after: updated,
      });
    } catch (auditError) {
      logError("Failed to record audit log for AI suggestion decision", auditError);
    }

    return NextResponse.json(updated);
  });
}
