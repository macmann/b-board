import { NextRequest, NextResponse } from "next/server";

import {
  AuditActorType,
  AuditEntityType,
  IssuePriority,
  IssueStatus,
  IssueType,
  Role,
} from "../../../../../lib/prismaEnums";
import { safeLogAudit } from "../../../../../lib/auditLogger";
import { setRequestContextUser, withRequestContext } from "../../../../../lib/requestContext";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import { jsonError } from "../../../../../lib/apiResponse";
import { getNextIssuePosition } from "../../../../../lib/issuePosition";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";
import { logError } from "../../../../../lib/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    setRequestContextUser(user.id, [user.role]);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return jsonError("Project not found", 404);
    }

    try {
      await requireProjectRole(user.id, project.id, [
        Role.ADMIN,
        Role.PO,
        Role.DEV,
        Role.QA,
      ]);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    const body = await request.json();

    const {
      title,
      type = IssueType.STORY,
      priority = IssuePriority.MEDIUM,
      storyPoints,
      assigneeId,
      epicId,
      description,
      sprintId,
      position,
    } = body;

    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 });
    }

    const validatedType = Object.values(IssueType).includes(type as IssueType)
      ? (type as IssueType)
      : IssueType.STORY;

    const validatedPriority = Object.values(IssuePriority).includes(
      priority as IssuePriority
    )
      ? (priority as IssuePriority)
      : IssuePriority.MEDIUM;

    const parsedStoryPoints =
      storyPoints === undefined || storyPoints === null || storyPoints === ""
        ? null
        : Number(storyPoints);

    const issueStatus = IssueStatus.TODO;
    const sprintIdValue = sprintId || null;
    const parsedPosition =
      position === undefined || position === null ? null : Number(position);
    let issuePosition: number | null = null;

    if (parsedPosition !== null && !Number.isNaN(parsedPosition)) {
      issuePosition = parsedPosition;
    } else if (sprintIdValue) {
      issuePosition = await getNextIssuePosition(
        projectId,
        sprintIdValue,
        issueStatus
      );
    }

    const projectInitial = (() => {
      const words = project.name.trim().split(" ");
      if (words.length === 1) return words[0][0].toUpperCase();
      return (words[0][0] + words[1][0]).toUpperCase();
    })();

    const count = await prisma.issue.count({ where: { projectId } });
    const key = `${projectInitial}-${count + 1}`;

    const issue = await prisma.issue.create({
      data: {
        projectId,
        key,
        title,
        type: validatedType,
        priority: validatedPriority,
        storyPoints: parsedStoryPoints,
        assigneeId: assigneeId ?? null,
        epicId: epicId ?? null,
        description: description ?? null,
        status: issueStatus,
        sprintId: sprintIdValue,
        ...(issuePosition !== null ? { position: issuePosition } : {}),
        reporterId: user.id,
      },
      include: {
        epic: true,
        assignee: true,
      },
    });

    try {
      await safeLogAudit({
        projectId,
        actorType: AuditActorType.USER,
        actorId: user.id,
        action: "ISSUE_CREATED",
        entityType: AuditEntityType.ISSUE,
        entityId: issue.id,
        summary: `Issue ${issue.key ?? issue.title} created`,
        after: {
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          type: issue.type,
          storyPoints: issue.storyPoints,
          assigneeId: issue.assigneeId,
          epicId: issue.epicId,
          sprintId: issue.sprintId,
          position: issue.position,
        },
      });
    } catch (auditError) {
      logError("Failed to record audit log for issue creation", auditError);
    }

    return NextResponse.json(issue, { status: 201 });
  });
}
