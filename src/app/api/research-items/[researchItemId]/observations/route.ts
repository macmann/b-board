import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";
import { ResearchObservationType } from "@prisma/client";
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
  { params }: { params: Promise<{ researchItemId: string }> }
) {
  const { researchItemId } = await params;

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

    const observations = await prisma.researchObservation.findMany({
      where: { researchItemId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(observations);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ researchItemId: string }> }
) {
  const { researchItemId } = await params;

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
        { message: "Cannot add observations to an archived item" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { type, content } = body ?? {};

    if (!type || !Object.values(ResearchObservationType).includes(type)) {
      return NextResponse.json({ message: "Invalid observation type" }, { status: 400 });
    }

    if (!content || typeof content !== "string") {
      return NextResponse.json({ message: "Content is required" }, { status: 400 });
    }

    const observation = await prisma.researchObservation.create({
      data: {
        researchItemId,
        type,
        content,
      },
    });

    return NextResponse.json(observation, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
