import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";
import { ResearchStatus } from "../../../../../lib/prismaEnums";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";

const researchBoardDisabledResponse = () =>
  NextResponse.json(
    {
      message:
        "Research board is disabled for this project. Project admins or owners can enable it in settings.",
    },
    { status: 403 }
  );

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
      return researchBoardDisabledResponse();
    }

    const items = await prisma.researchItem.findMany({
      where: {
        projectId,
        status: { not: ResearchStatus.ARCHIVED },
      },
      orderBy: [
        { status: "asc" },
        { position: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        assignee: { select: { id: true, name: true } },
        issueLinks: {
          include: {
            issue: {
              select: {
                assignee: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        position: item.position,
        researchType: item.tags[0] ?? null,
        assignee:
          item.assignee ??
          (item.issueLinks
            .map((link) => link.issue?.assignee)
            .find(Boolean) ?? null),
        dueDate: item.dueDate,
        linkedIssuesCount: item.issueLinks.length,
        updatedAt: item.updatedAt,
      })),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
