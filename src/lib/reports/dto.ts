import { NextRequest, NextResponse } from "next/server";

import { resolveProjectId, type ProjectParams } from "../params";
import { formatReportDate, parseReportFilter } from "./filters";

export type ReportFilters = {
  projectId: string;
  from: string;
  to: string;
  sprintId?: string | "all";
};

export type BurndownPoint = {
  date: string;
  remainingPoints: number;
  remainingIssues: number;
};

export type VelocityPoint = {
  sprintId: string;
  sprintName: string;
  completedPoints: number;
  completedIssues: number;
  startDate?: string;
  endDate?: string;
};

export type CycleTimePoint = {
  issueId: string;
  key: string;
  title: string;
  startedAt?: string;
  doneAt?: string;
  cycleTimeDays?: number;
};

export type CycleTimeSummary = {
  median: number | null;
  p75: number | null;
  p90: number | null;
};

export type StandupInsight = {
  date: string;
  blockersCount: number;
  dependenciesCount: number;
  updatesCount: number;
  topBlockers: string[];
  hasAiSummary: boolean;
  summaryExcerpt?: string;
  summary?: string;
};

export type BlockerTheme = {
  theme: string;
  count: number;
  examples: string[];
};

export type CycleTimeReport = {
  points: CycleTimePoint[];
  summary: CycleTimeSummary;
};

const invalidResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status });

export async function parseReportFilters(
  request: NextRequest,
  params: ProjectParams
): Promise<{ filters: ReportFilters } | { error: NextResponse }> {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return { error: invalidResponse("projectId is required", 400) };
  }

  const searchParams = request.nextUrl.searchParams;
  const sprintId = searchParams.get("sprintId") ?? undefined;

  const range = parseReportFilter(searchParams, { projectId });
  const resolvedProjectId = range.projectId ?? projectId;
  if (!resolvedProjectId) {
    return { error: invalidResponse("projectId is required", 400) };
  }

  return {
    filters: {
      projectId: resolvedProjectId,
      from: formatReportDate(range.from),
      to: formatReportDate(range.to),
      ...(sprintId ? { sprintId } : {}),
    },
  };
}
