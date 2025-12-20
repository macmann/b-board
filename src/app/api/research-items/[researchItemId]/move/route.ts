import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { ResearchStatus } from "../../../../../lib/prismaEnums";
import {
  AuthorizationError,
  PROJECT_CONTRIBUTOR_ROLES,
  requireProjectRole,
} from "../../../../../lib/permissions";
import { recalculateResearchPositions } from "../../../../../lib/researchPosition";

const RESEARCH_STATUS_SET = new Set(Object.values(ResearchStatus));

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ researchItemId: string }> }
) {
  const { researchItemId } = await ctx.params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const researchItem = await prisma.researchItem.findUnique({
      where: { id: researchItemId },
      select: { id: true, projectId: true },
    });

    if (!researchItem) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    const body = await request.json();
    const { projectId, newStatus, newPosition } = body as {
      projectId?: string;
      newStatus?: string;
      newPosition?: number;
    };

    if (!projectId || researchItem.projectId !== projectId) {
      return NextResponse.json({ message: "Invalid project" }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { enableResearchBoard: true },
    });

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    if (!project.enableResearchBoard) {
      return NextResponse.json(
        { message: "Research board is disabled for this project." },
        { status: 403 }
      );
    }

    if (typeof newPosition !== "number" || Number.isNaN(newPosition)) {
      return NextResponse.json({ message: "newPosition must be a number" }, { status: 400 });
    }

    if (!RESEARCH_STATUS_SET.has(newStatus as ResearchStatus)) {
      return NextResponse.json({ message: "Invalid status" }, { status: 400 });
    }

    const targetStatus = newStatus as ResearchStatus;

    if (targetStatus === ResearchStatus.ARCHIVED) {
      return NextResponse.json({ message: "Cannot move to archived" }, { status: 400 });
    }

    try {
      await requireProjectRole(user.id, projectId, PROJECT_CONTRIBUTOR_ROLES);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }

      throw error;
    }

    const itemsInColumn = await prisma.researchItem.findMany({
      where: { projectId, status: targetStatus },
      orderBy: [
        { position: "asc" },
        { createdAt: "asc" },
      ],
      select: { id: true },
    });

    const filteredItems = itemsInColumn.filter((item) => item.id !== researchItemId);
    const insertionIndex = Math.max(
      0,
      Math.min(filteredItems.length, Math.floor(newPosition))
    );
    filteredItems.splice(insertionIndex, 0, { id: researchItemId });

    const recalculatedPositions = recalculateResearchPositions(filteredItems, 1, 0);

    const updatedItems = await prisma.$transaction(
      recalculatedPositions.map(({ id, position }) =>
        prisma.researchItem.update({
          where: { id },
          data: {
            position,
            ...(id === researchItemId ? { status: targetStatus } : {}),
          },
        })
      )
    );

    return NextResponse.json({ success: true, items: updatedItems });
  } catch (error) {
    return NextResponse.json({ message: "Failed to move research item" }, { status: 500 });
  }
}
