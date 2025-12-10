import { IssueType } from "../../../../../lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    await ensureProjectRole(prisma, user.id, project.id, PROJECT_VIEWER_ROLES);

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const assigneeId = searchParams.get("assigneeId");
    const epicId = searchParams.get("epicId");

    const issues = await prisma.issue.findMany({
      where: {
        projectId,
        ...(type && Object.values(IssueType).includes(type as IssueType)
          ? { type: type as IssueType }
          : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(epicId ? { epicId } : {}),
      },
      include: {
        sprint: true,
        epic: true,
        assignee: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });

    const sprintGroups = sprints.map((sprint) => ({
      id: sprint.id,
      name: sprint.name,
      type: "sprint" as const,
      status: sprint.status,
      issues: issues.filter((issue) => issue.sprintId === sprint.id),
    }));

    const backlogGroup = {
      id: "backlog",
      name: "Product Backlog",
      type: "backlog" as const,
      issues: issues.filter((issue) => issue.sprintId === null),
    };

    return NextResponse.json([...sprintGroups, backlogGroup]);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
