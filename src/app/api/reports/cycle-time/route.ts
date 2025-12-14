import { IssueHistoryField, IssueStatus, Role } from "@/lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";

type Bucket = {
  label: string;
  count: number;
};

type CycleTimeItem = {
  issueKey: string;
  title: string;
  cycleHours: number;
  completedAt: string;
};

const parseDateParam = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const computePercentile = (values: number[], percentile: number) => {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) return sorted[lower];

  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const getAllowedProjectIds = async (user: { id: string; role: Role }, projectId: string | null) => {
  if (user.role === Role.ADMIN) {
    return projectId ? [projectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjects = memberships.map((membership) => membership.projectId);

  if (projectId) {
    if (!memberProjects.includes(projectId)) {
      return [];
    }
    return [projectId];
  }

  return memberProjects;
};

const determineStartDate = (history: { newValue: string | null; createdAt: Date }[], createdAt: Date) => {
  const inProgressTransition = history.find(
    (entry) => entry.newValue === IssueStatus.IN_PROGRESS
  );

  return inProgressTransition?.createdAt ?? createdAt;
};

const determineCompletionDate = (
  history: { newValue: string | null; createdAt: Date }[],
  status: IssueStatus,
  updatedAt: Date
) => {
  const doneTransition = history.find((entry) => entry.newValue === IssueStatus.DONE);

  if (doneTransition?.createdAt) {
    return doneTransition.createdAt as Date;
  }

  if (status === IssueStatus.DONE) {
    return updatedAt;
  }

  return null;
};

const bucketize = (hours: number[]): Bucket[] => {
  const ranges = [
    { label: "0-1d", min: 0, max: 24 },
    { label: "1-3d", min: 24, max: 72 },
    { label: "3-7d", min: 72, max: 168 },
    { label: "7-14d", min: 168, max: 336 },
    { label: "14d+", min: 336, max: Infinity },
  ];

  return ranges.map((range) => ({
    label: range.label,
    count: hours.filter((value) => value >= range.min && value < range.max).length,
  }));
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));
  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== "all" ? projectParam : null;

  if (!from || !to) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  const allowedProjectIds = await getAllowedProjectIds(user, projectId);

  if (allowedProjectIds && allowedProjectIds.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const issues = await prisma.issue.findMany({
    where: {
      ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
    },
    select: {
      key: true,
      title: true,
      createdAt: true,
      status: true,
      updatedAt: true,
      history: {
        where: { field: IssueHistoryField.STATUS },
        orderBy: { createdAt: "asc" },
        select: { newValue: true, createdAt: true },
      },
    },
  });

  const completedWithinRange: CycleTimeItem[] = [];

  for (const issue of issues) {
    const completionDate = determineCompletionDate(issue.history, issue.status, issue.updatedAt);

    if (!completionDate) continue;

    if (completionDate < from || completionDate > to) continue;

    const startDate = determineStartDate(issue.history, issue.createdAt);
    const cycleHours = Math.max(
      (completionDate.getTime() - startDate.getTime()) / (1000 * 60 * 60),
      0
    );

    completedWithinRange.push({
      issueKey: issue.key ?? "Unkeyed",
      title: issue.title,
      cycleHours,
      completedAt: completionDate.toISOString(),
    });
  }

  const hoursList = completedWithinRange.map((item) => item.cycleHours);
  const sampleSize = hoursList.length;

  const summary = {
    medianHours: Number(computePercentile(hoursList, 50).toFixed(1)),
    p75Hours: Number(computePercentile(hoursList, 75).toFixed(1)),
    avgHours:
      sampleSize === 0
        ? 0
        : Number((hoursList.reduce((sum, value) => sum + value, 0) / sampleSize).toFixed(1)),
    sampleSize,
  };

  const buckets = bucketize(hoursList);

  const items = completedWithinRange
    .sort((a, b) => b.cycleHours - a.cycleHours)
    .slice(0, 20);

  return NextResponse.json({ summary, buckets, items });
}
