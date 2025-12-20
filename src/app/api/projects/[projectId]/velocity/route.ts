import { IssueStatus, SprintStatus } from "../../../../../lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
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

  const completedSprints = await prisma.sprint.findMany({
    where: {
      projectId,
      status: SprintStatus.COMPLETED,
    },
    orderBy: { endDate: "desc" },
    take: 10,
  });

  const sprintIds = completedSprints.map((sprint) => sprint.id);

  const issuesBySprint = await prisma.issue.findMany({
    where: {
      sprintId: { in: sprintIds },
      projectId,
    },
    select: {
      sprintId: true,
      storyPoints: true,
      status: true,
    },
  });

  const velocity = completedSprints.map((sprint) => {
    const sprintIssues = issuesBySprint.filter(
      (issue) => issue.sprintId === sprint.id
    );

    const committedPoints = sprintIssues.reduce(
      (total, issue) => total + (issue.storyPoints ?? 0),
      0
    );

    const completedPoints = sprintIssues.reduce((total, issue) => {
      if (issue.status === IssueStatus.DONE) {
        return total + (issue.storyPoints ?? 0);
      }
      return total;
    }, 0);

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      startDate: sprint.startDate?.toISOString() ?? null,
      endDate: sprint.endDate?.toISOString() ?? null,
      committedPoints,
      completedPoints,
    };
  });

  return NextResponse.json(velocity);
}
