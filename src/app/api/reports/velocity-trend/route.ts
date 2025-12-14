import { IssueHistoryField, IssueStatus, Role, SprintStatus } from "@/lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";

const ALL_PROJECTS_VALUE = "all";

const clampLimit = (raw: string | null) => {
  const parsed = raw ? Number.parseInt(raw, 10) : null;
  if (!parsed || Number.isNaN(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), 50);
};

const completionWithinSprint = (
  sprint: { startDate: Date | null; endDate: Date | null },
  completion: Date | null
) => {
  if (!completion || !sprint.startDate || !sprint.endDate) return false;
  return completion >= sprint.startDate && completion <= sprint.endDate;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== ALL_PROJECTS_VALUE ? projectParam : null;
  const limit = clampLimit(searchParams.get("limit"));

  let allowedProjectIds: string[] | null = null;

  if (user.role === Role.ADMIN) {
    allowedProjectIds = projectId ? [projectId] : null;
  } else {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      select: { projectId: true },
    });

    const memberProjects = memberships.map((membership) => membership.projectId);

    if (projectId) {
      if (!memberProjects.includes(projectId)) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      allowedProjectIds = [projectId];
    } else {
      allowedProjectIds = memberProjects;
    }

    if (!allowedProjectIds || allowedProjectIds.length === 0) {
      return NextResponse.json({ sprints: [] });
    }
  }

  const sprintWhere = {
    status: SprintStatus.COMPLETED,
    ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
  } as const;

  const completedSprints = await prisma.sprint.findMany({
    where: sprintWhere,
    orderBy: { endDate: "desc" },
    take: limit,
  });

  if (completedSprints.length === 0) {
    return NextResponse.json({ sprints: [] });
  }

  const sprintIds = completedSprints.map((sprint) => sprint.id);

  const issues = await prisma.issue.findMany({
    where: {
      sprintId: { in: sprintIds },
      ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
    },
    select: {
      sprintId: true,
      storyPoints: true,
      status: true,
      updatedAt: true,
      history: {
        where: { field: IssueHistoryField.STATUS },
        orderBy: { createdAt: "asc" },
        select: { newValue: true, createdAt: true },
      },
    },
  });

  const sprints = completedSprints.map((sprint) => {
    const sprintIssues = issues.filter((issue) => issue.sprintId === sprint.id);

    const committedPoints = sprintIssues.reduce(
      (total, issue) => total + (issue.storyPoints ?? 0),
      0
    );

    const completedPoints = sprintIssues.reduce((total, issue) => {
      const doneTransition = issue.history.find(
        (entry) => entry.newValue === IssueStatus.DONE
      );

      const completionDate = doneTransition?.createdAt
        ? (doneTransition.createdAt as Date)
        : issue.status === IssueStatus.DONE
          ? issue.updatedAt
          : null;

      if (completionWithinSprint(sprint, completionDate)) {
        return total + (issue.storyPoints ?? 0);
      }

      return total;
    }, 0);

    const spilloverPoints = Math.max(committedPoints - completedPoints, 0);

    return {
      id: sprint.id,
      name: sprint.name,
      endDate: sprint.endDate?.toISOString() ?? "",
      committedPoints,
      completedPoints,
      spilloverPoints,
    };
  });

  return NextResponse.json({ sprints });
}
