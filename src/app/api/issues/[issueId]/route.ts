import { IssueHistoryField, IssuePriority, IssueStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../lib/auth";
import prisma from "../../../../lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { issueId: string } }
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: params.issueId },
    include: {
      project: true,
      sprint: true,
      epic: true,
      assignee: true,
      reporter: true,
    },
  });

  if (!issue) {
    return NextResponse.json({ message: "Issue not found" }, { status: 404 });
  }

  return NextResponse.json(issue);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { issueId: string } }
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const existingIssue = await prisma.issue.findUnique({
    where: { id: params.issueId },
  });

  if (!existingIssue) {
    return NextResponse.json({ message: "Issue not found" }, { status: 404 });
  }

  const body = await request.json();

  const {
    title,
    description,
    status,
    priority,
    storyPoints,
    assigneeId,
    epicId,
    sprintId,
  } = body;

  const data: Record<string, any> = {};

  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description ?? null;

  if (status !== undefined) {
    data.status = Object.values(IssueStatus).includes(status as IssueStatus)
      ? (status as IssueStatus)
      : existingIssue.status;
  }

  if (priority !== undefined) {
    data.priority = Object.values(IssuePriority).includes(priority as IssuePriority)
      ? (priority as IssuePriority)
      : existingIssue.priority;
  }

  if (storyPoints !== undefined) {
    const parsedStoryPoints =
      storyPoints === null || storyPoints === "" || storyPoints === undefined
        ? null
        : Number(storyPoints);
    data.storyPoints = Number.isNaN(parsedStoryPoints) ? null : parsedStoryPoints;
  }

  if (assigneeId !== undefined) {
    data.assigneeId = assigneeId || null;
  }

  if (epicId !== undefined) {
    data.epicId = epicId || null;
  }

  if (sprintId !== undefined) {
    data.sprintId = sprintId || null;
  }

  const historyEntries = [] as Array<{ field: IssueHistoryField; oldValue: string | null; newValue: string | null }>;

  const trackChange = (
    field: IssueHistoryField,
    oldValue: string | number | null,
    newValue: string | number | null
  ) => {
    const oldVal = oldValue === undefined ? null : oldValue;
    const newVal = newValue === undefined ? null : newValue;

    if (oldVal === newVal) return;

    historyEntries.push({
      field,
      oldValue: oldVal === null ? null : String(oldVal),
      newValue: newVal === null ? null : String(newVal),
    });
  };

  trackChange(
    IssueHistoryField.STATUS,
    existingIssue.status,
    data.status ?? existingIssue.status
  );
  trackChange(
    IssueHistoryField.ASSIGNEE,
    existingIssue.assigneeId ?? null,
    data.assigneeId ?? existingIssue.assigneeId ?? null
  );
  trackChange(
    IssueHistoryField.STORY_POINTS,
    existingIssue.storyPoints ?? null,
    data.storyPoints ?? existingIssue.storyPoints ?? null
  );
  trackChange(
    IssueHistoryField.SPRINT,
    existingIssue.sprintId ?? null,
    data.sprintId ?? existingIssue.sprintId ?? null
  );

  const updatedIssue = await prisma.$transaction(async (tx) => {
    const issue = await tx.issue.update({
      where: { id: params.issueId },
      data,
      include: {
        project: true,
        sprint: true,
        epic: true,
        assignee: true,
        reporter: true,
      },
    });

    if (historyEntries.length > 0) {
      await tx.issueHistory.createMany({
        data: historyEntries.map((entry) => ({
          issueId: issue.id,
          changedById: user.id,
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
        })),
      });
    }

    return issue;
  });

  return NextResponse.json(updatedIssue);
}
