import { NextRequest, NextResponse } from "next/server";
import { SprintStatus } from "../../../../../lib/prismaEnums";

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

    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId, status: SprintStatus.ACTIVE },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    return NextResponse.json(activeSprint);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
