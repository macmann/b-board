import { IssueHistoryField, IssueStatus, SprintStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { sprintId: string } }
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sprint = await prisma.sprint.findUnique({
    where: { id: params.sprintId },
  });

  if (!sprint) {
    return NextResponse.json({ message: "Sprint not found" }, { status: 404 });
  }

  if (sprint.status !== SprintStatus.ACTIVE) {
    return NextResponse.json(
      { message: "Only active sprints can be completed" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedSprint = await tx.sprint.update({
      where: { id: sprint.id },
      data: {
        status: SprintStatus.COMPLETED,
        endDate: sprint.endDate ?? new Date(),
      },
    });

    const incompleteIssues = await tx.issue.findMany({
      where: {
        sprintId: sprint.id,
        status: { not: IssueStatus.DONE },
      },
      select: { id: true },
    });

    if (incompleteIssues.length > 0) {
      const issueIds = incompleteIssues.map((issue) => issue.id);

      await tx.issue.updateMany({
        where: { id: { in: issueIds } },
        data: { sprintId: null },
      });

      await tx.issueHistory.createMany({
        data: incompleteIssues.map((issue) => ({
          issueId: issue.id,
          changedById: user.id,
          field: IssueHistoryField.SPRINT,
          oldValue: sprint.id,
          newValue: null,
        })),
      });
    }

    return updatedSprint;
  });

  return NextResponse.json(result);
}
