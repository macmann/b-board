import {
  AuditActorType,
  AuditEntityType,
  IssueHistoryField,
  IssuePriority,
  IssueStatus,
  IssueType,
  Role,
  UserRole,
} from "../../../../lib/prismaEnums";
import { NextRequest } from "next/server";

import { getUserFromRequest } from "../../../../lib/auth";
import { jsonError, jsonOk } from "../../../../lib/apiResponse";
import prisma from "../../../../lib/db";
import { logError } from "../../../../lib/logger";
import {
  EDITABLE_FIELD_TO_HISTORY_FIELD,
  type EditableIssuePatchField,
} from "../../../../lib/issueHistory";
import { safeLogAudit } from "../../../../lib/auditLogger";
import { setRequestContextUser, withRequestContext } from "../../../../lib/requestContext";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;

  return withRequestContext(request, async () => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id, [user.role]);

      const issue = await prisma.issue.findUnique({
        where: { id: issueId },
        include: {
          project: true,
          sprint: true,
          epic: true,
          assignee: true,
          reporter: true,
          attachments: { where: { commentId: null } },
          buildLinks: {
            include: {
              build: {
                select: {
                  id: true,
                  key: true,
                  name: true,
                  status: true,
                  environment: true,
                  plannedAt: true,
                  deployedAt: true,
                  projectId: true,
                },
              },
            },
          },
        },
      });

      if (!issue) {
        return jsonError("Issue not found", 404);
      }

      return jsonOk(issue);
    } catch (error) {
      logError("Failed to fetch issue", error);
      return jsonError("Something went wrong", 500);
    }
  });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;

  return withRequestContext(request, async () => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id, [user.role]);

      const existingIssue = await prisma.issue.findUnique({
        where: { id: issueId },
      });

      if (!existingIssue) {
        return jsonError("Issue not found", 404);
      }

      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: existingIssue.projectId, userId: user.id },
        },
        select: { role: true },
      });

      const userRoles = [user.role, membership?.role].filter(Boolean) as UserRole[];
      setRequestContextUser(user.id, userRoles);

      const isAdminOrPo =
        user.role === UserRole.ADMIN ||
        membership?.role === Role.ADMIN ||
        membership?.role === Role.PO;

      const isDevOrQa = membership?.role === Role.DEV || membership?.role === Role.QA;

      if (!isAdminOrPo) {
        const isReporterOrAssignee =
          isDevOrQa &&
          (user.id === existingIssue.assigneeId || user.id === existingIssue.reporterId);

        if (!isReporterOrAssignee) {
          return jsonError("Forbidden", 403);
        }
      }

      const body = await request.json();

      const {
        title,
        description,
        status,
        priority,
        storyPoints,
        assigneeId,
        epicId,
        sprintId,
        type,
      } = body;

      const data: Record<string, any> = {};

      if (title !== undefined) data.title = title;
      if (description !== undefined) data.description = description ?? null;

      if (status !== undefined) {
        data.status = Object.values(IssueStatus).includes(status as IssueStatus)
          ? (status as IssueStatus)
          : existingIssue.status;
      }

      if (type !== undefined) {
        data.type = Object.values(IssueType).includes(type as IssueType)
          ? (type as IssueType)
          : existingIssue.type;
      }

      if (priority !== undefined) {
        data.priority = Object.values(IssuePriority).includes(priority as IssuePriority)
          ? (priority as IssuePriority)
          : existingIssue.priority;
      }

      if (storyPoints !== undefined) {
        const parsedStoryPoints =
          storyPoints === null || storyPoints === "" || storyPoints === undefined
            ? null
            : Number(storyPoints);
        data.storyPoints = Number.isNaN(parsedStoryPoints) ? null : parsedStoryPoints;
      }

      if (assigneeId !== undefined) {
        if (assigneeId) {
          const assigneeMembership = await prisma.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId: existingIssue.projectId,
                userId: assigneeId,
              },
            },
            select: { userId: true },
          });

          if (!assigneeMembership) {
            return jsonError("Assignee must be a member of this project", 400);
          }
        }

        if (assigneeId) {
          data.assignee = { connect: { id: assigneeId } };
        } else {
          data.assignee = { disconnect: true };
        }
      }

      if (epicId !== undefined) {
        if (epicId) {
          data.epic = { connect: { id: epicId } };
        } else {
          data.epic = { disconnect: true };
        }
      }

      if (sprintId !== undefined) {
        if (sprintId) {
          data.sprint = { connect: { id: sprintId } };
        } else {
          data.sprint = { disconnect: true };
        }
      }

      const historyEntries = [] as Array<{
        field: IssueHistoryField;
        oldValue: string | null;
        newValue: string | null;
      }>;

      const trackChange = (
        field: IssueHistoryField,
        oldValue: string | number | null,
        newValue: string | number | null
      ) => {
        const oldVal = oldValue === undefined ? null : oldValue;
        const newVal = newValue === undefined ? null : newValue;

        if (oldVal === newVal) return;

        historyEntries.push({
          field,
          oldValue: oldVal === null ? null : String(oldVal),
          newValue: newVal === null ? null : String(newVal),
        });
      };

      const nextEpicId =
        epicId !== undefined ? (epicId ? epicId : null) : existingIssue.epicId ?? null;
      const nextSprintId =
        sprintId !== undefined ? (sprintId ? sprintId : null) : existingIssue.sprintId ?? null;

      const editableFieldValues: Record<
        EditableIssuePatchField,
        { oldValue: string | number | null; newValue: string | number | null }
      > = {
        type: {
          oldValue: existingIssue.type,
          newValue: data.type ?? existingIssue.type,
        },
        status: {
          oldValue: existingIssue.status,
          newValue: data.status ?? existingIssue.status,
        },
        priority: {
          oldValue: existingIssue.priority,
          newValue: data.priority ?? existingIssue.priority,
        },
        storyPoints: {
          oldValue: existingIssue.storyPoints ?? null,
          newValue: data.storyPoints ?? existingIssue.storyPoints ?? null,
        },
        assigneeId: {
          oldValue: existingIssue.assigneeId ?? null,
          newValue:
            assigneeId !== undefined
              ? assigneeId || null
              : existingIssue.assigneeId ?? null,
        },
        epicId: {
          oldValue: existingIssue.epicId ?? null,
          newValue: nextEpicId,
        },
      };

      (Object.entries(editableFieldValues) as Array<
        [EditableIssuePatchField, { oldValue: string | number | null; newValue: string | number | null }]
      >).forEach(([editableField, values]) => {
        trackChange(
          EDITABLE_FIELD_TO_HISTORY_FIELD[editableField],
          values.oldValue,
          values.newValue
        );
      });

      trackChange(
        IssueHistoryField.SPRINT,
        existingIssue.sprintId ?? null,
        nextSprintId
      );

      const updatedIssue = await prisma.$transaction(async (tx) => {
        const issue = await tx.issue.update({
          where: { id: issueId },
          data,
          include: {
            project: true,
            sprint: true,
            epic: true,
            assignee: true,
            reporter: true,
            attachments: { where: { commentId: null } },
          },
        });

        if (historyEntries.length > 0) {
          await tx.issueHistory.createMany({
            data: historyEntries.map((entry) => ({
              issueId: issue.id,
              changedById: user.id,
              field: entry.field,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
            })),
          });
        }

        return issue;
      });

      const beforeChanges: Record<string, unknown> = {};
      const afterChanges: Record<string, unknown> = {};

      const trackAuditChange = (field: string, beforeValue: unknown, afterValue: unknown) => {
        if (beforeValue === afterValue) return;
        beforeChanges[field] = beforeValue ?? null;
        afterChanges[field] = afterValue ?? null;
      };

      trackAuditChange("title", existingIssue.title, updatedIssue.title);
      trackAuditChange("description", existingIssue.description, updatedIssue.description);
      trackAuditChange("status", existingIssue.status, updatedIssue.status);
      trackAuditChange("priority", existingIssue.priority, updatedIssue.priority);
      trackAuditChange("type", existingIssue.type, updatedIssue.type);
      trackAuditChange("storyPoints", existingIssue.storyPoints, updatedIssue.storyPoints);
      trackAuditChange("assigneeId", existingIssue.assigneeId, updatedIssue.assigneeId);
      trackAuditChange("epicId", existingIssue.epicId, updatedIssue.epicId);
      trackAuditChange("sprintId", existingIssue.sprintId, updatedIssue.sprintId);

      const changedFields = Object.keys(afterChanges);

      if (changedFields.length > 0) {
        try {
          await safeLogAudit({
            projectId: existingIssue.projectId,
            actorType: AuditActorType.USER,
            actorId: user.id,
            action: "ISSUE_UPDATED",
            entityType: AuditEntityType.ISSUE,
            entityId: issueId,
            summary: `Updated ${changedFields.join(", ")}`,
            before: beforeChanges,
            after: afterChanges,
          });
        } catch (auditError) {
          logError("Failed to record audit log for issue update", auditError);
        }
      }

      return jsonOk(updatedIssue);
    } catch (error) {
      logError("Failed to update issue", error);
      return jsonError("Something went wrong", 500);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;

  return withRequestContext(request, async () => {
    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id, [user.role]);

      const existingIssue = await prisma.issue.findUnique({
        where: { id: issueId },
        select: { id: true, projectId: true, title: true, status: true, key: true },
      });

      if (!existingIssue) {
        return jsonError("Issue not found", 404);
      }

      if (user.role !== UserRole.ADMIN) {
        const membership = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: existingIssue.projectId,
              userId: user.id,
            },
          },
          select: { role: true },
        });

        const isProjectAdminOrPo =
          membership?.role === Role.ADMIN || membership?.role === Role.PO;

        if (!isProjectAdminOrPo) {
          return jsonError("Forbidden", 403);
        }
      }

      await prisma.issue.delete({ where: { id: issueId } });

      try {
        await safeLogAudit({
          projectId: existingIssue.projectId,
          actorType: AuditActorType.USER,
          actorId: user.id,
          action: "ISSUE_DELETED",
          entityType: AuditEntityType.ISSUE,
          entityId: issueId,
          summary: `Deleted issue ${existingIssue.key ?? existingIssue.title ?? issueId}`,
          before: {
            title: existingIssue.title,
            status: existingIssue.status,
          },
          after: null,
        });
      } catch (auditError) {
        logError("Failed to record audit log for issue deletion", auditError);
      }

      return jsonOk({ message: "Issue deleted" });
    } catch (error) {
      logError("Failed to delete issue", error);
      return jsonError("Something went wrong", 500);
    }
  });
}
