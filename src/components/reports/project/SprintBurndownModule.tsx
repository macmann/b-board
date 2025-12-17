"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BurndownPoint } from "@/lib/reports/dto";
import {
  areReportFiltersEqual,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const scopeValue = (point: BurndownPoint | undefined) => {
  if (!point) return 0;
  return point.remainingPoints > 0 ? point.remainingPoints : point.remainingIssues;
};

const StatPill = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

type SprintOption = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

type SprintBurndownModuleProps = {
  projectId: string;
  initialFilters: ReportFilters;
  sprints: SprintOption[];
};

export default function SprintBurndownModule({
  projectId,
  initialFilters,
  sprints,
}: SprintBurndownModuleProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [data, setData] = useState<BurndownPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseReportSearchParams(searchParams);
    if (!areReportFiltersEqual(parsed.filters, filters)) {
      setFilters(parsed.filters);
    }
  }, [filters, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();

    params.set("from", filters.dateFrom);
    params.set("to", filters.dateTo);

    if (filters.sprintId) {
      params.set("sprintId", filters.sprintId);
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/projects/${projectId}/reports/burndown?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load burndown data.");
        }

        return body?.data as BurndownPoint[];
      })
      .then((payload) => setData(payload ?? []))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setData([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.sprintId, projectId]);

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === filters.sprintId) ?? null,
    [filters.sprintId, sprints]
  );

  const usingIssueCounts = useMemo(
    () => (data ?? []).every((point) => point.remainingPoints === 0),
    [data]
  );

  const chartData = useMemo(
    () =>
      (data ?? []).map((point) => ({
        date: formatDateLabel(point.date),
        remaining: usingIssueCounts ? point.remainingIssues : point.remainingPoints,
        issues: point.remainingIssues,
      })),
    [data, usingIssueCounts]
  );

  const startingScope = scopeValue(data?.[0]);
  const remainingScope = scopeValue(data?.at(-1));

  const daysLeft = useMemo(() => {
    if (!selectedSprint?.endDate) return null;

    const today = new Date();
    const end = new Date(`${selectedSprint.endDate}T23:59:59.999Z`);
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return diffDays < 0 ? 0 : diffDays;
  }, [selectedSprint?.endDate]);

  const hasSprints = sprints.length > 0;
  const showEmptySprintState = !hasSprints;
  const hasSeries = (data?.length ?? 0) > 0;
  const showNoIssuesState = !hasSeries && !isLoading && !error;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatPill label="Starting scope" value={hasSeries ? startingScope : "–"} />
        <StatPill label="Remaining scope" value={hasSeries ? remainingScope : "–"} />
        {selectedSprint?.endDate ? (
          <StatPill label="Days left" value={daysLeft ?? "–"} />
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        {isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading burndown...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : showEmptySprintState ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add a sprint to see burndown over its duration.
          </p>
        ) : showNoIssuesState ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No issues found for this range.</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#475569" tickFormatter={(value) => value} />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  name={usingIssueCounts ? "Remaining issues" : "Remaining points"}
                />
                {usingIssueCounts ? null : (
                  <Line
                    type="monotone"
                    dataKey="issues"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Remaining issues"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
