import { IssueType } from "../../../../../lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

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
        sprintId: null,
        ...(type && Object.values(IssueType).includes(type as IssueType)
          ? { type: type as IssueType }
          : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(epicId ? { epicId } : {}),
      },
      include: {
        epic: true,
        assignee: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(issues);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
