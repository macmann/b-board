import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { enableResearchBoard: true },
  });

  if (!project?.enableResearchBoard) {
    return NextResponse.json(
      {
        message:
          "Research board is disabled for this project. Project admins or owners can enable it in settings.",
      },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = (searchParams.get("query") ?? searchParams.get("q") ?? "").trim();
  const takeParam = Number(searchParams.get("take"));
  const take = Number.isFinite(takeParam)
    ? Math.min(Math.max(takeParam, 1), 50)
    : 20;

  const researchItems = await prisma.researchItem.findMany({
    where: {
      projectId,
      ...(query
        ? {
            OR: [
              { key: { contains: query, mode: "insensitive" } },
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      assignee: true,
    },
    orderBy: { updatedAt: "desc" },
    take,
  });

  return NextResponse.json(researchItems);
}
