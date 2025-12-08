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
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const { sprintId } = await params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
    });

    if (!sprint) {
      return NextResponse.json({ message: "Sprint not found" }, { status: 404 });
    }

    await ensureProjectRole(
      prisma,
      user.id,
      sprint.projectId,
      PROJECT_VIEWER_ROLES
    );

    const issues = await prisma.issue.findMany({
      where: { sprintId },
      include: {
        assignee: true,
        epic: true,
      },
      orderBy: [
        { status: "asc" },
        { position: "asc" },
      ],
    });

    return NextResponse.json(issues);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
