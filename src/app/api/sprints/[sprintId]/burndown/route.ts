import { IssueHistoryField, IssueStatus } from "../../../../../lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

const formatDate = (date: Date) => date.toISOString().split("T")[0];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const { sprintId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { project: true },
  });

  if (!sprint) {
    return NextResponse.json({ message: "Sprint not found" }, { status: 404 });
  }

  if (!sprint.startDate || !sprint.endDate) {
    return NextResponse.json(
      { message: "Sprint dates are not defined" },
      { status: 400 }
    );
  }

  const issues = await prisma.issue.findMany({
    where: {
      sprintId,
      projectId: sprint.projectId,
    },
    select: {
      id: true,
      storyPoints: true,
      status: true,
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

  const totalPoints = issues.reduce(
    (sum, issue) => sum + (issue.storyPoints ?? 0),
    0
  );

  const completionDates: { id: string; points: number; completion?: Date }[] =
    issues.map((issue) => {
      const doneChange = issue.history.find(
        (entry) => entry.newValue === IssueStatus.DONE
      );

      if (doneChange) {
        return {
          id: issue.id,
          points: issue.storyPoints ?? 0,
          completion: doneChange.createdAt,
        };
      }

      if (issue.status === IssueStatus.DONE) {
        return {
          id: issue.id,
          points: issue.storyPoints ?? 0,
          completion: sprint.endDate,
        };
      }

      return { id: issue.id, points: issue.storyPoints ?? 0 };
    });

  const burndown: { date: string; remainingPoints: number }[] = [];

  const currentDate = new Date(sprint.startDate);
  while (currentDate <= sprint.endDate) {
    const completedByDay = completionDates.reduce((sum, issue) => {
      if (issue.completion && issue.completion <= currentDate) {
        return sum + issue.points;
      }
      return sum;
    }, 0);

    burndown.push({
      date: formatDate(currentDate),
      remainingPoints: Math.max(totalPoints - completedByDay, 0),
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return NextResponse.json(burndown);
}
