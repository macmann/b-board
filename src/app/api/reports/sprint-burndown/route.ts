import { IssueHistoryField, IssueStatus, Role, SprintStatus } from "@/lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";

const formatDate = (date: Date) => date.toISOString().split("T")[0];

const findDefaultSprint = async (userId: string, projectId?: string | null) => {
  if (projectId) {
    return prisma.sprint.findFirst({
      where: { projectId, status: SprintStatus.ACTIVE },
      orderBy: { startDate: "desc" },
    });
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });

  const projectIds = memberships.map((membership) => membership.projectId);

  if (projectIds.length === 0) {
    return null;
  }

  return prisma.sprint.findFirst({
    where: { projectId: { in: projectIds }, status: SprintStatus.ACTIVE },
    orderBy: { startDate: "desc" },
  });
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sprintIdParam = searchParams.get("sprintId");
  const projectIdParam = searchParams.get("projectId");
  const projectId = projectIdParam && projectIdParam !== "all" ? projectIdParam : null;

  const sprint = sprintIdParam
    ? await prisma.sprint.findUnique({ where: { id: sprintIdParam } })
    : await findDefaultSprint(user.id, projectId);

  if (!sprint) {
    return NextResponse.json({ message: "No sprint found" }, { status: 404 });
  }

  if (!sprint.startDate || !sprint.endDate) {
    return NextResponse.json(
      { message: "Sprint dates are not defined" },
      { status: 400 }
    );
  }

  if (user.role !== Role.ADMIN) {
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: sprint.projectId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const issues = await prisma.issue.findMany({
    where: { sprintId: sprint.id, projectId: sprint.projectId },
    select: {
      storyPoints: true,
      status: true,
      updatedAt: true,
      history: {
        where: { field: IssueHistoryField.STATUS },
        orderBy: { createdAt: "asc" },
        select: {
          newValue: true,
          createdAt: true,
        },
      },
    },
  });

  const pointsTotal = issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);

  const completionDates = issues.map((issue) => {
    const doneTransition = issue.history.find(
      (entry) => entry.newValue === IssueStatus.DONE
    );

    const completion = doneTransition?.createdAt
      ? (doneTransition.createdAt as Date)
      : issue.status === IssueStatus.DONE
        ? issue.updatedAt
        : null;

    return { points: issue.storyPoints ?? 0, completion };
  });

  const series: { date: string; remainingPoints: number; completedPoints: number }[] = [];
  const currentDate = new Date(sprint.startDate);

  while (currentDate <= sprint.endDate) {
    const completedPoints = completionDates.reduce((sum, issue) => {
      if (issue.completion && issue.completion <= currentDate) {
        return sum + issue.points;
      }
      return sum;
    }, 0);

    series.push({
      date: formatDate(currentDate),
      remainingPoints: Math.max(pointsTotal - completedPoints, 0),
      completedPoints,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return NextResponse.json({
    sprint: {
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    },
    pointsTotal,
    series,
  });
}
