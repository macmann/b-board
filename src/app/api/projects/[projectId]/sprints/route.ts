import { NextRequest, NextResponse } from "next/server";
import { SprintStatus } from "../../../../../lib/prismaEnums";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/apiResponse";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/permissions";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
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

    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    const sprintIds = sprints.map((sprint) => sprint.id);

    const sprintsWithStoryPoints = sprintIds.length
      ? await prisma.issue.groupBy({
          by: ["sprintId"],
          where: {
            projectId,
            sprintId: { in: sprintIds },
          },
          _sum: { storyPoints: true },
        })
      : [];

    const sprintStoryPointsMap = new Map(
      sprintsWithStoryPoints
        .filter((group) => group.sprintId)
        .map((group) => [group.sprintId as string, group._sum.storyPoints ?? 0])
    );

    return NextResponse.json(
      sprints.map((sprint) => ({
        ...sprint,
        storyPoints: sprintStoryPointsMap.get(sprint.id) ?? 0,
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
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return jsonError("Project not found", 404);
    }

    await ensureProjectRole(prisma, user.id, project.id, PROJECT_ADMIN_ROLES);

    const body = await request.json();
    const { name, goal, startDate, endDate } = body;

    if (!name) {
      return NextResponse.json({ message: "Name is required" }, { status: 400 });
    }

    const parseDate = (value: string | null | undefined) => {
      if (!value) return null;

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const parsedStartDate = parseDate(startDate);
    const parsedEndDate = parseDate(endDate);

    if (startDate && !parsedStartDate) {
      return NextResponse.json({ message: "Invalid start date" }, { status: 400 });
    }

    if (endDate && !parsedEndDate) {
      return NextResponse.json({ message: "Invalid end date" }, { status: 400 });
    }

    const sprint = await prisma.sprint.create({
      data: {
        projectId,
        name,
        goal: goal ?? null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        status: SprintStatus.PLANNED,
      },
    });

    return NextResponse.json(sprint, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
