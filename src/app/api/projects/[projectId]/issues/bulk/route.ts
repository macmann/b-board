import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getUserFromRequest } from "@/lib/auth";
import { safeLogAudit } from "@/lib/auditLogger";
import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import {
  AuditActorType,
  AuditEntityType,
  IssueHistoryField,
  IssuePriority,
  IssueStatus,
  IssueType,
  Role,
  UserRole,
} from "@/lib/prismaEnums";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";

const VALID_ACTION_TYPES = ["STATUS", "ASSIGNEE", "PRIORITY", "SPRINT", "DELETE"] as const;
type BulkActionType = (typeof VALID_ACTION_TYPES)[number];

type BulkAction = {
  type: BulkActionType;
  value?: string | null;
};

type BulkFilterInput = {
  statuses?: IssueStatus[];
  type?: IssueType;
  priority?: IssuePriority;
  assigneeId?: string | null;
  sprintId?: string | null;
  epicId?: string;
  search?: string;
};

type Failure = { issueId: string; key: string | null; reason: string };

type AuditQueueItem = {
  issueId: string;
  projectId: string;
  action: "ISSUE_UPDATED" | "ISSUE_DELETED";
  summary: string;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
};

const normalizeStatuses = (statuses: unknown): IssueStatus[] => {
  if (!Array.isArray(statuses)) return [];
  const validStatuses = Object.values(IssueStatus);
  return statuses.filter((status): status is IssueStatus =>
    validStatuses.includes(status as IssueStatus)
  );
};

const buildFilter = (projectId: string, filter: BulkFilterInput): Prisma.IssueWhereInput => {
  const where: Prisma.IssueWhereInput = {
    projectId,
  };

  const statuses = normalizeStatuses(filter.statuses ?? []);
  if (statuses.length > 0) {
    where.status = { in: statuses };
  }

  if (filter.type && Object.values(IssueType).includes(filter.type)) {
    where.type = filter.type;
  }

  if (filter.priority && Object.values(IssuePriority).includes(filter.priority)) {
    where.priority = filter.priority;
  }

  if (filter.assigneeId !== undefined) {
    if (filter.assigneeId === null) {
      where.assigneeId = null;
    } else {
      where.assigneeId = filter.assigneeId;
    }
  }

  if (filter.sprintId !== undefined) {
    if (filter.sprintId === null) {
      where.sprintId = null;
    } else {
      where.sprintId = filter.sprintId;
    }
  }

  if (filter.epicId) {
    where.epicId = filter.epicId;
  }

  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: "insensitive" } },
      { key: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  return where;
};

const mapIssuesForPreview = (
  issues: Array<{
    id: string;
    key: string | null;
    title: string;
    status: IssueStatus;
    assignee: { name: string | null; email: string | null } | null;
    sprint: { name: string } | null;
  }>
) =>
  issues.map((issue) => ({
    id: issue.id,
    key: issue.key,
    title: issue.title,
    status: issue.status,
    assigneeName: issue.assignee?.name ?? issue.assignee?.email ?? "",
    sprintName: issue.sprint?.name ?? "",
  }));

const assertAction = (action: BulkAction | null): BulkAction => {
  if (!action) {
    throw new Error("Action is required for bulk operations.");
  }

  if (!VALID_ACTION_TYPES.includes(action.type)) {
    throw new Error("Invalid bulk action type.");
  }

  return action;
};

const normalizeAssigneeId = async (projectId: string, assigneeId: string | null) => {
  if (!assigneeId || assigneeId === "UNASSIGNED") return null;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: assigneeId } },
    select: { userId: true },
  });

  if (!membership) {
    throw new Error("Assignee must be a member of this project.");
  }

  return assigneeId;
};

const normalizeSprintId = async (projectId: string, sprintId: string | null) => {
  if (!sprintId || sprintId === "BACKLOG") return null;

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, projectId: true },
  });

  if (!sprint || sprint.projectId !== projectId) {
    throw new Error("Sprint must belong to this project.");
  }

  return sprintId;
};

const validateActionValue = async (
  projectId: string,
  action: BulkAction
): Promise<{ value: string | null; historyField: IssueHistoryField | null }> => {
  switch (action.type) {
    case "STATUS": {
      const isValid = Object.values(IssueStatus).includes(action.value as IssueStatus);
      if (!isValid || !action.value) {
        throw new Error("A valid status is required.");
      }
      return { value: action.value, historyField: IssueHistoryField.STATUS };
    }
    case "ASSIGNEE": {
      const assigneeId = await normalizeAssigneeId(projectId, action.value ?? null);
      return { value: assigneeId, historyField: IssueHistoryField.ASSIGNEE };
    }
    case "PRIORITY": {
      const isValid = Object.values(IssuePriority).includes(action.value as IssuePriority);
      if (!isValid || !action.value) {
        throw new Error("A valid priority is required.");
      }
      return { value: action.value, historyField: IssueHistoryField.PRIORITY };
    }
    case "SPRINT": {
      const sprintId = await normalizeSprintId(projectId, action.value ?? null);
      return { value: sprintId, historyField: IssueHistoryField.SPRINT };
    }
    case "DELETE": {
      return { value: null, historyField: null };
    }
    default:
      throw new Error("Unsupported bulk action.");
  }
};

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await ctx.params;

  return withRequestContext(request, async () => {
    try {
      const body = await request.json().catch(() => null);
      const filter = (body?.filter ?? {}) as BulkFilterInput;
      const previewOnly = Boolean(body?.previewOnly);

      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      const membership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: user.id } },
        select: { role: true },
      });

      const userRoles = [user.role, membership?.role].filter(Boolean) as UserRole[];
      setRequestContextUser(user.id, userRoles);

      const isAdmin =
        user.role === UserRole.ADMIN ||
        membership?.role === Role.ADMIN ||
        membership?.role === Role.PO;

      if (!isAdmin) {
        return jsonError("Forbidden", 403);
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!project) {
        return jsonError("Project not found", 404);
      }

      const normalizedFilter: BulkFilterInput = {
        statuses: normalizeStatuses(filter.statuses ?? []),
        type: filter.type,
        priority: filter.priority,
        assigneeId:
          filter.assigneeId === "UNASSIGNED"
            ? null
            : filter.assigneeId ?? undefined,
        sprintId:
          filter.sprintId === "BACKLOG"
            ? null
            : filter.sprintId ?? undefined,
        epicId: filter.epicId,
        search: filter.search?.trim() || undefined,
      };

      const issues = await prisma.issue.findMany({
        where: buildFilter(projectId, normalizedFilter),
        include: {
          assignee: { select: { name: true, email: true } },
          sprint: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      if (previewOnly || !body?.action) {
        return jsonOk({ issues: mapIssuesForPreview(issues) });
      }

      if (issues.length === 0) {
        return jsonError("No issues match the provided filter.", 400);
      }

      const action = assertAction(body.action as BulkAction);
      let normalizedValue: string | null;
      let historyField: IssueHistoryField | null;

      try {
        const validationResult = await validateActionValue(projectId, action);
        normalizedValue = validationResult.value;
        historyField = validationResult.historyField;
      } catch (validationError) {
        const message =
          validationError instanceof Error
            ? validationError.message
            : "Invalid bulk action payload.";
        return jsonError(message, 400);
      }

      const failures: Failure[] = [];
      let successCount = 0;
      const auditQueue: AuditQueueItem[] = [];

      await prisma.$transaction(async (tx) => {
        for (const issue of issues) {
          try {
            if (action.type === "DELETE") {
              await tx.issue.delete({ where: { id: issue.id } });

              auditQueue.push({
                issueId: issue.id,
                projectId,
                action: "ISSUE_DELETED",
                summary: `Bulk operation: deleted ${issue.key ?? issue.title}`,
                before: { title: issue.title, status: issue.status },
                after: null,
              });
              successCount += 1;
              continue;
            }

            const data: Prisma.IssueUpdateInput = {};
            let oldValue: string | null = null;
            let newValue: string | null = null;

            switch (action.type) {
              case "STATUS":
                oldValue = issue.status;
                newValue = normalizedValue as string;
                data.status = normalizedValue as IssueStatus;
                break;
              case "ASSIGNEE":
                oldValue = issue.assigneeId ?? null;
                newValue = (normalizedValue as string | null) ?? null;
                if (normalizedValue) {
                  data.assignee = { connect: { id: normalizedValue } };
                } else {
                  data.assignee = { disconnect: true };
                }
                break;
              case "PRIORITY":
                oldValue = issue.priority;
                newValue = normalizedValue as string;
                data.priority = normalizedValue as IssuePriority;
                break;
              case "SPRINT":
                oldValue = issue.sprintId ?? null;
                newValue = (normalizedValue as string | null) ?? null;
                if (normalizedValue) {
                  data.sprint = { connect: { id: normalizedValue } };
                } else {
                  data.sprint = { disconnect: true };
                }
                break;
              default:
                break;
            }

            const updatedIssue = await tx.issue.update({
              where: { id: issue.id },
              data,
            });

            if (historyField) {
              await tx.issueHistory.create({
                data: {
                  issueId: issue.id,
                  changedById: user.id,
                  field: historyField,
                  oldValue: oldValue,
                  newValue: newValue,
                },
              });
            }

            auditQueue.push({
              issueId: issue.id,
              projectId,
              action: "ISSUE_UPDATED",
              summary: `Bulk operation: set ${action.type.toLowerCase()} for ${issue.key ?? issue.title}`,
              before: historyField ? { [action.type.toLowerCase()]: oldValue } : {},
              after: historyField ? { [action.type.toLowerCase()]: newValue } : {},
            });

            successCount += 1;

            if (!updatedIssue) {
              throw new Error("Failed to update issue");
            }
          } catch (err) {
            const reason = err instanceof Error ? err.message : "Unexpected failure";
            failures.push({ issueId: issue.id, key: issue.key, reason });
          }
        }
      });

      const failureCount = failures.length;

      for (const audit of auditQueue) {
        try {
          await safeLogAudit({
            projectId: audit.projectId,
            actorType: AuditActorType.USER,
            actorId: user.id,
            action: audit.action,
            entityType: AuditEntityType.ISSUE,
            entityId: audit.issueId,
            summary: audit.summary,
            before: audit.before,
            after: audit.after,
          });
        } catch (auditError) {
          logError("Failed to record audit log for bulk operation", auditError);
        }
      }

      return jsonOk({ successCount, failureCount, failures });
    } catch (error) {
      logError("Failed to process bulk issues", error);
      return jsonError("Something went wrong", 500);
    }
  });
}
