import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";
import { ResearchStatus } from "../../../../../lib/prismaEnums";

const researchBoardDisabledResponse = () =>
  NextResponse.json(
    {
      message:
        "Research board is disabled for this project. Project admins or owners can enable it in settings.",
    },
    { status: 403 }
  );

async function getResearchItemWithProject(researchItemId: string) {
  return prisma.researchItem.findUnique({
    where: { id: researchItemId },
    include: { project: { select: { id: true, enableResearchBoard: true } } },
  });
}

async function ensureAccess(
  researchItemId: string,
  userId: string,
  roles: typeof PROJECT_VIEWER_ROLES | typeof PROJECT_CONTRIBUTOR_ROLES
) {
  const researchItem = await getResearchItemWithProject(researchItemId);

  if (!researchItem) return { researchItem: null, enabled: false } as const;

  await ensureProjectRole(prisma, userId, researchItem.projectId, roles);

  return { researchItem, enabled: researchItem.project.enableResearchBoard } as const;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { researchItemId: string } }
) {
  const { researchItemId } = params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const access = await ensureAccess(researchItemId, user.id, PROJECT_VIEWER_ROLES);

    if (!access.researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!access.enabled) {
      return researchBoardDisabledResponse();
    }

    const links = await prisma.researchItemIssueLink.findMany({
      where: { researchItemId },
      include: {
        issue: {
          select: {
            id: true,
            key: true,
            title: true,
            status: true,
            priority: true,
            assignee: { select: { id: true, name: true } },
            assigneeId: true,
            projectId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      links.map((link) => ({
        id: link.id,
        issueId: link.issueId,
        key: link.issue.key,
        title: link.issue.title,
        status: link.issue.status,
        priority: link.issue.priority,
        assignee: link.issue.assignee,
        createdAt: link.createdAt,
      }))
    );
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { researchItemId: string } }
) {
  const { researchItemId } = params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const access = await ensureAccess(
      researchItemId,
      user.id,
      PROJECT_CONTRIBUTOR_ROLES
    );

    if (!access.researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!access.enabled) {
      return researchBoardDisabledResponse();
    }

    if (access.researchItem.status === ResearchStatus.ARCHIVED) {
      return NextResponse.json(
        { message: "Cannot link issues to an archived research item" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { issueId } = (body ?? {}) as { issueId?: string };

    if (!issueId) {
      return NextResponse.json({ message: "issueId is required" }, { status: 400 });
    }

    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { id: true, projectId: true },
    });

    if (!issue || issue.projectId !== access.researchItem.projectId) {
      return NextResponse.json(
        { message: "Issue must belong to the same project" },
        { status: 400 }
      );
    }

    try {
      const link = await prisma.researchItemIssueLink.create({
        data: { researchItemId, issueId },
      });

      return NextResponse.json(link, { status: 201 });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return NextResponse.json({ message: "Issue already linked" }, { status: 409 });
      }

      throw err;
    }
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { researchItemId: string } }
) {
  const { researchItemId } = params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const access = await ensureAccess(
      researchItemId,
      user.id,
      PROJECT_CONTRIBUTOR_ROLES
    );

    if (!access.researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!access.enabled) {
      return researchBoardDisabledResponse();
    }

    const body = await request.json();
    const { issueId } = (body ?? {}) as { issueId?: string };

    if (!issueId) {
      return NextResponse.json({ message: "issueId is required" }, { status: 400 });
    }

    await prisma.researchItemIssueLink.deleteMany({
      where: { researchItemId, issueId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
