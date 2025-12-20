import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
  AISuggestionTargetType,
  AuditActorType,
  AuditEntityType,
  Role,
  UserRole,
} from "@/lib/prismaEnums";
import { safeLogAudit } from "@/lib/auditLogger";
import { logError } from "@/lib/logger";

type ApplyPayload = {
  applyTitle?: boolean;
  applyDescription?: boolean;
  applyAcceptanceCriteria?: boolean;
};

type AutoFillDraft = {
  userStory?: string;
  description?: string;
  acceptanceCriteria?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  outOfScope?: string[];
};

const ALLOWED_ROLES: Role[] = [
  Role.ADMIN,
  Role.PO,
  Role.DEV,
  Role.QA,
  Role.VIEWER,
];

const buildAcceptanceCriteriaBlock = (criteria: string[]): string => {
  if (!criteria.length) return "";
  return `Acceptance Criteria:\n${criteria.map((item) => `- ${item}`).join("\n")}`;
};

const buildAutofillDescription = (draft: AutoFillDraft) => {
  const sections = [
    draft.userStory ? `User Story:\n${draft.userStory}` : null,
    draft.description ?? null,
    draft.acceptanceCriteria?.length
      ? buildAcceptanceCriteriaBlock(draft.acceptanceCriteria)
      : null,
    draft.assumptions?.length
      ? `Assumptions:\n${draft.assumptions.map((item) => `- ${item}`).join("\n")}`
      : null,
    draft.openQuestions?.length
      ? `Open Questions:\n${draft.openQuestions.map((item) => `- ${item}`).join("\n")}`
      : null,
    draft.outOfScope?.length
      ? `Out of Scope:\n${draft.outOfScope.map((item) => `- ${item}`).join("\n")}`
      : null,
  ].filter(Boolean);

  return sections.join("\n\n").trim();
};

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
      await requireProjectRole(user.id, projectId, ALLOWED_ROLES);
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

    if (
      !["IMPROVE_TEXT", "AUTOFILL_USER_STORY"].includes(
        suggestion.suggestionType
      )
    ) {
      return jsonError("Unsupported suggestion type", 400);
    }

    if (suggestion.targetType !== AISuggestionTargetType.ISSUE) {
      return jsonError("Unsupported suggestion target", 400);
    }

    const issue = await prisma.issue.findUnique({ where: { id: suggestion.targetId } });

    if (!issue) {
      return jsonError("Target issue not found", 404);
    }

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { role: true },
    });

    const userRoles = [user.role, membership?.role].filter(Boolean) as UserRole[];
    setRequestContextUser(user.id, userRoles);

    const isAdminOrPo =
      user.role === UserRole.ADMIN ||
      membership?.role === Role.ADMIN ||
      membership?.role === Role.PO;

    const isDevOrQa = membership?.role === Role.DEV || membership?.role === Role.QA;
    const isReporterOrAssignee =
      isDevOrQa && (issue.assigneeId === user.id || issue.reporterId === user.id);

    if (!isAdminOrPo && !isReporterOrAssignee) {
      return jsonError("Forbidden", 403);
    }

    const body: ApplyPayload = (await request.json().catch(() => ({}))) as ApplyPayload;
    const now = new Date();

    if (suggestion.suggestionType === "AUTOFILL_USER_STORY") {
      const draftResult = z
        .object({
          userStory: z.string().optional(),
          description: z.string().optional(),
          acceptanceCriteria: z.array(z.string()).optional(),
          assumptions: z.array(z.string()).optional(),
          openQuestions: z.array(z.string()).optional(),
          outOfScope: z.array(z.string()).optional(),
        })
        .safeParse(suggestion.payload);

      if (!draftResult.success) {
        return jsonError("Invalid suggestion payload", 500);
      }

      const nextDescription = buildAutofillDescription(draftResult.data);

      if (!nextDescription) {
        return jsonError("No draft content available to apply", 400);
      }

      if (nextDescription === (issue.description ?? "")) {
        return jsonError("No changes to apply", 400);
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedIssue = await tx.issue.update({
          where: { id: issue.id },
          data: { description: nextDescription },
        });

        const updatedSuggestion = await tx.aISuggestion.update({
          where: { id: suggestion.id },
          data: {
            status: AISuggestionStatus.APPLIED,
            decidedByUserId: user.id,
            decidedAt: now,
            snoozedUntil: null,
          },
        });

        return { updatedIssue, updatedSuggestion };
      });

      try {
        await safeLogAudit({
          projectId,
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: "ISSUE_UPDATED",
          entityType: AuditEntityType.ISSUE,
          entityId: issue.id,
          summary: "Updated description via AI autofill",
          before: { description: issue.description ?? null },
          after: { description: result.updatedIssue.description ?? null },
        });
      } catch (auditError) {
        logError("Failed to record audit log for issue update via AI", auditError);
      }

      try {
        await safeLogAudit({
          projectId,
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: "AI_SUGGESTION_APPLIED",
          entityType: AuditEntityType.AI_SUGGESTION,
          entityId: suggestion.id,
          summary: "Applied AI autofill suggestion",
          metadata: { appliedAutofillDraft: true },
          before: suggestion,
          after: result.updatedSuggestion,
        });
      } catch (auditError) {
        logError("Failed to record audit log for AI suggestion apply", auditError);
      }

      return NextResponse.json({ issue: result.updatedIssue, suggestion: result.updatedSuggestion });
    }

    const payload = suggestion.payload as {
      recommendedTitle?: string;
      recommendedDescription?: string;
      recommendedAcceptanceCriteria?: string[];
    };

    const updates: Record<string, string | null> = {};

    if (body.applyTitle && payload.recommendedTitle) {
      updates.title = payload.recommendedTitle;
    }

    let description = issue.description ?? null;

    if (body.applyDescription && payload.recommendedDescription) {
      description = payload.recommendedDescription;
    }

    if (body.applyAcceptanceCriteria && payload.recommendedAcceptanceCriteria) {
      const criteriaBlock = buildAcceptanceCriteriaBlock(payload.recommendedAcceptanceCriteria);
      description = [description, criteriaBlock].filter(Boolean).join("\n\n");
    }

    if (description !== issue.description) {
      updates.description = description;
    }

    if (Object.keys(updates).length === 0) {
      return jsonError("No fields selected to apply", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedIssue = await tx.issue.update({
        where: { id: issue.id },
        data: updates,
      });

      const updatedSuggestion = await tx.aISuggestion.update({
        where: { id: suggestion.id },
        data: {
          status: AISuggestionStatus.APPLIED,
          decidedByUserId: user.id,
          decidedAt: now,
          snoozedUntil: null,
        },
      });

      return { updatedIssue, updatedSuggestion };
    });

    const beforeChanges: Record<string, unknown> = {};
    const afterChanges: Record<string, unknown> = {};

    if (updates.title && updates.title !== issue.title) {
      beforeChanges.title = issue.title;
      afterChanges.title = updates.title;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "description")) {
      beforeChanges.description = issue.description ?? null;
      afterChanges.description = updates.description ?? null;
    }

    const changedFields = Object.keys(afterChanges);

    if (changedFields.length > 0) {
      try {
        await safeLogAudit({
          projectId,
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: "ISSUE_UPDATED",
          entityType: AuditEntityType.ISSUE,
          entityId: issue.id,
          summary: `Updated ${changedFields.join(", ")}`,
          before: beforeChanges,
          after: afterChanges,
        });
      } catch (auditError) {
        logError("Failed to record audit log for issue update via AI", auditError);
      }
    }

    try {
      await safeLogAudit({
        projectId,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: "AI_SUGGESTION_APPLIED",
        entityType: AuditEntityType.AI_SUGGESTION,
        entityId: suggestion.id,
        summary: "Applied AI suggestion",
        metadata: {
          appliedTitle: Boolean(body.applyTitle && payload.recommendedTitle),
          appliedDescription: Boolean(body.applyDescription && payload.recommendedDescription),
          appliedAcceptanceCriteria: Boolean(
            body.applyAcceptanceCriteria && payload.recommendedAcceptanceCriteria?.length
          ),
        },
        before: suggestion,
        after: result.updatedSuggestion,
      });
    } catch (auditError) {
      logError("Failed to record audit log for AI suggestion apply", auditError);
    }

    return NextResponse.json({
      issue: result.updatedIssue,
      suggestion: result.updatedSuggestion,
    });
  });
}
