import { IssuePriority, IssueStatus, IssueType, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import { jsonError } from "../../../../../lib/apiResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
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

  const issue = await prisma.issue.create({
    data: {
      projectId: params.projectId,
      title,
      type: validatedType,
      priority: validatedPriority,
      storyPoints: parsedStoryPoints,
      assigneeId: assigneeId ?? null,
      epicId: epicId ?? null,
      description: description ?? null,
      status: IssueStatus.TODO,
      reporterId: user.id,
    },
    include: {
      epic: true,
      assignee: true,
    },
  });

  return NextResponse.json(issue, { status: 201 });
}
