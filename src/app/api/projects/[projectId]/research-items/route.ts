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
      select: { id: true, enableResearchBoard: true },
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    await ensureProjectRole(prisma, user.id, project.id, PROJECT_VIEWER_ROLES);

    if (!project.enableResearchBoard) {
      return NextResponse.json({ message: "Research board is disabled" }, { status: 404 });
    }

    const researchItems = await prisma.researchItem.findMany({
      where: { projectId },
      include: {
        issueLinks: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(
      researchItems.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        researchType: item.tags[0] ?? null,
        assignee: null,
        dueDate: null,
        linkedIssuesCount: item.issueLinks.length,
        updatedAt: item.updatedAt,
      }))
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
