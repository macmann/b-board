import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  IssueHistoryField,
  IssueStatus,
  Role,
} from "@/lib/prismaEnums";

type ProjectStatusRow = {
  projectId: string;
  projectName: string;
  status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_DATA";
  healthScore: number | null;
  medianLeadTimeDays: number | null;
  openBlockers: number;
};

type ProjectStatusOverviewResponse = {
  summary: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    avgHealthScore: number | null;
  };
  rows: ProjectStatusRow[];
  aiObservation: string | null;
};

const DEFAULT_RANGE_DAYS = 30;

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - DEFAULT_RANGE_DAYS);
  defaultFrom.setHours(0, 0, 0, 0);

  const parsedFrom = parseDateOnly(searchParams.get("from"));
  const parsedTo = parseDateOnly(searchParams.get("to"));

  const from = parsedFrom ? new Date(parsedFrom) : defaultFrom;
  const to = parsedTo ? new Date(parsedTo) : today;

  if (to < from) {
    return { from: defaultFrom, to: today };
  }

  return { from, to };
};

const getAccessibleProjectIds = async (
  user: { id: string; role: Role },
  projectId: string | null
) => {
  const leadershipRoles = new Set<Role>([Role.ADMIN, Role.PO]);

  if (leadershipRoles.has(user.role)) {
    return projectId ? [projectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjectIds = memberships.map((membership) => membership.projectId);

  if (projectId) {
    if (!memberProjectIds.includes(projectId)) {
      return [] as string[];
    }
    return [projectId];
  }

  return memberProjectIds;
};

const median = (values: number[]) => {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const buildLeadTimeMap = (
  entries: Array<{
    issueId: string;
    createdAt: Date;
    issue: { createdAt: Date; projectId: string };
  }>
) => {
  const latestDonePerIssue = new Map<
    string,
    { projectId: string; doneAt: Date; createdAt: Date }
  >();

  entries.forEach((entry) => {
    const existing = latestDonePerIssue.get(entry.issueId);

    if (!existing || existing.doneAt < entry.createdAt) {
      latestDonePerIssue.set(entry.issueId, {
        projectId: entry.issue.projectId,
        doneAt: entry.createdAt,
        createdAt: entry.issue.createdAt,
      });
    }
  });

  const durations = new Map<string, number[]>();

  latestDonePerIssue.forEach((entry) => {
    const elapsedMs = entry.doneAt.getTime() - entry.createdAt.getTime();
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);

    const existing = durations.get(entry.projectId) ?? [];
    existing.push(elapsedDays);
    durations.set(entry.projectId, existing);
  });

  return durations;
};

const computeStatus = (openBlockers: number, medianLeadTimeDays: number | null) => {
  if (medianLeadTimeDays === null && openBlockers === 0) {
    return "NO_DATA" as const;
  }

  if (openBlockers >= 3 || (medianLeadTimeDays ?? 0) >= 7) {
    return "OFF_TRACK" as const;
  }

  if (openBlockers >= 1 || (medianLeadTimeDays ?? 0) >= 4) {
    return "AT_RISK" as const;
  }

  return "ON_TRACK" as const;
};

const computeHealthScore = (
  openBlockers: number,
  medianLeadTimeDays: number | null
): number | null => {
  if (medianLeadTimeDays === null && openBlockers === 0) {
    return null;
  }

  const blockerPenalty = Math.min(openBlockers * 10, 40);
  const leadTimePenalty = Math.min((medianLeadTimeDays ?? 0) * 5, 40);

  return clamp(100 - blockerPenalty - leadTimePenalty, 0, 100);
};

const buildObservation = (rows: ProjectStatusRow[]) => {
  const rowsWithData = rows.filter((row) => row.status !== "NO_DATA");

  if (rowsWithData.length === 0) {
    return "No portfolio observation available (insufficient data).";
  }

  const blockerLeader = rowsWithData.reduce((top, current) =>
    current.openBlockers > top.openBlockers ? current : top
  );

  const leadTimeCandidates = rowsWithData.filter(
    (row) => row.medianLeadTimeDays !== null
  );
  const slowestLeadTime = leadTimeCandidates.sort(
    (a, b) => (b.medianLeadTimeDays ?? 0) - (a.medianLeadTimeDays ?? 0)
  )[0];

  const parts: string[] = [];

  if (blockerLeader.openBlockers > 0) {
    parts.push(
      `Highest blocker load: ${blockerLeader.projectName} (${blockerLeader.openBlockers}).`
    );
  }

  if (slowestLeadTime?.medianLeadTimeDays) {
    parts.push(
      `Longest lead time: ${slowestLeadTime.projectName} (${slowestLeadTime.medianLeadTimeDays.toFixed(
        1
      )}d).`
    );
  }

  if (parts.length === 0) {
    return "No portfolio observation available (insufficient data).";
  }

  return parts.join(" ");
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { from, to } = getDateRange(searchParams);

  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== "all" ? projectParam : null;

  const accessibleProjectIds = await getAccessibleProjectIds(user, projectId);

  if (accessibleProjectIds && accessibleProjectIds.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    where: {
      ...(accessibleProjectIds ? { id: { in: accessibleProjectIds } } : {}),
      isArchived: false,
    },
    select: { id: true, name: true },
  });

  if (projects.length === 0) {
    const empty: ProjectStatusOverviewResponse = {
      summary: { onTrack: 0, atRisk: 0, offTrack: 0, avgHealthScore: null },
      rows: [],
      aiObservation: "No portfolio observation available (insufficient data).",
    };

    return NextResponse.json(empty);
  }

  const projectIds = projects.map((project) => project.id);

  const [standupEntries, doneInRange, doneOverall] = await Promise.all([
    prisma.dailyStandupEntry.findMany({
      where: {
        projectId: { in: projectIds },
        date: { gte: from, lte: to },
        blockers: { not: null },
      },
      select: { projectId: true, blockers: true },
    }),
    prisma.issueHistory.findMany({
      where: {
        field: IssueHistoryField.STATUS,
        newValue: IssueStatus.DONE,
        createdAt: { gte: from, lte: to },
        issue: { projectId: { in: projectIds } },
      },
      select: {
        issueId: true,
        createdAt: true,
        issue: { select: { createdAt: true, projectId: true } },
      },
    }),
    prisma.issueHistory.findMany({
      where: {
        field: IssueHistoryField.STATUS,
        newValue: IssueStatus.DONE,
        issue: { projectId: { in: projectIds } },
      },
      select: {
        issueId: true,
        createdAt: true,
        issue: { select: { createdAt: true, projectId: true } },
      },
    }),
  ]);

  const blockersByProject = new Map<string, number>();

  standupEntries.forEach((entry) => {
    if (!entry.blockers?.trim()) return;

    const current = blockersByProject.get(entry.projectId) ?? 0;
    blockersByProject.set(entry.projectId, current + 1);
  });

  const leadTimesInRange = buildLeadTimeMap(doneInRange);
  const leadTimesOverall = buildLeadTimeMap(doneOverall);

  const rows: ProjectStatusRow[] = projects.map((project) => {
    const blockers = blockersByProject.get(project.id) ?? 0;
    const leadTimes =
      leadTimesInRange.get(project.id)?.length
        ? leadTimesInRange.get(project.id)!
        : leadTimesOverall.get(project.id) ?? [];

    const leadTimeMedian = median(leadTimes ?? []);
    const status = computeStatus(blockers, leadTimeMedian);
    const healthScore = computeHealthScore(blockers, leadTimeMedian);

    return {
      projectId: project.id,
      projectName: project.name,
      status,
      healthScore,
      medianLeadTimeDays:
        leadTimeMedian === null
          ? null
          : Number(leadTimeMedian.toFixed(1)),
      openBlockers: blockers,
    };
  });

  const summary = rows.reduce(
    (acc, row) => {
      if (row.status === "ON_TRACK") acc.onTrack += 1;
      if (row.status === "AT_RISK") acc.atRisk += 1;
      if (row.status === "OFF_TRACK") acc.offTrack += 1;

      if (row.healthScore !== null) {
        acc.healthScoreTotal += row.healthScore;
        acc.healthScoreCount += 1;
      }

      return acc;
    },
    { onTrack: 0, atRisk: 0, offTrack: 0, healthScoreTotal: 0, healthScoreCount: 0 }
  );

  const avgHealthScore =
    summary.healthScoreCount > 0
      ? Math.round(summary.healthScoreTotal / summary.healthScoreCount)
      : null;

  const response: ProjectStatusOverviewResponse = {
    summary: {
      onTrack: summary.onTrack,
      atRisk: summary.atRisk,
      offTrack: summary.offTrack,
      avgHealthScore,
    },
    rows,
    aiObservation: buildObservation(rows),
  };

  return NextResponse.json(response);
}
