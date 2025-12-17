import { NextRequest, NextResponse } from "next/server";

import { resolveProjectId, type ProjectParams } from "../params";

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

const DEFAULT_RANGE_DAYS = 14;
const MAX_RANGE_DAYS = 180;

const isIsoDateString = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultRange = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1));

  return { from: formatDate(from), to: formatDate(to) };
};

const clampRange = (from: Date, to: Date) => {
  const diffMs = to.getTime() - from.getTime();
  const maxMs = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

  if (diffMs <= maxMs) return { from, to };

  const clampedFrom = new Date(to);
  clampedFrom.setDate(clampedFrom.getDate() - (MAX_RANGE_DAYS - 1));
  return { from: clampedFrom, to };
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
  const defaults = getDefaultRange();
  const fromParam = searchParams.get("from") ?? defaults.from;
  const toParam = searchParams.get("to") ?? defaults.to;
  const sprintId = searchParams.get("sprintId") ?? undefined;

  if (!isIsoDateString(fromParam) || !isIsoDateString(toParam)) {
    return { error: invalidResponse("from and to must be ISO date strings", 400) };
  }

  const fromDate = new Date(fromParam);
  const toDate = new Date(toParam);

  if (toDate.getTime() < fromDate.getTime()) {
    return { error: invalidResponse("to date must be on or after from date", 400) };
  }

  const { from: clampedFrom, to: clampedTo } = clampRange(fromDate, toDate);

  return {
    filters: {
      projectId,
      from: formatDate(clampedFrom),
      to: formatDate(clampedTo),
      ...(sprintId ? { sprintId } : {}),
    },
  };
}
