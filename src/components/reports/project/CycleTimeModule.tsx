"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { CycleTimeReport } from "@/lib/reports/dto";
import {
  areReportFiltersEqual,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

type CycleTimeModuleProps = {
  projectId: string;
  initialFilters: ReportFilters;
};

type SortKey = "cycleTimeDays" | "doneAt" | "startedAt" | "title";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

const formatDays = (value?: number | null) =>
  typeof value === "number" ? `${value}d` : "–";

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : "–";

const buildHistogram = (report: CycleTimeReport | null) => {
  const buckets = [
    { label: "0-1", min: 0, max: 1 },
    { label: "2-3", min: 2, max: 3 },
    { label: "4-7", min: 4, max: 7 },
    { label: "8-14", min: 8, max: 14 },
    { label: "15+", min: 15, max: Infinity },
  ];

  const counts = Object.fromEntries(buckets.map((bucket) => [bucket.label, 0]));

  for (const point of report?.points ?? []) {
    const duration = point.cycleTimeDays;
    if (typeof duration !== "number") continue;
    const bucket = buckets.find(
      (range) => duration >= range.min && duration <= range.max
    );
    if (bucket) {
      counts[bucket.label] += 1;
    }
  }

  return buckets.map((bucket) => ({
    range: bucket.label,
    count: counts[bucket.label],
  }));
};

export default function CycleTimeModule({
  projectId,
  initialFilters,
}: CycleTimeModuleProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [report, setReport] = useState<CycleTimeReport | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "cycleTimeDays", direction: "desc" });
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

    fetch(`/api/projects/${projectId}/reports/cycle-time?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load cycle time data.");
        }
        return body?.data as CycleTimeReport;
      })
      .then((payload) => setReport(payload ?? { points: [], summary: { median: null, p75: null, p90: null } }))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setReport({ points: [], summary: { median: null, p75: null, p90: null } });
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.sprintId, projectId]);

  const histogram = useMemo(() => buildHistogram(report), [report]);
  const hasData = (report?.points.length ?? 0) > 0;
  const summary = report?.summary;

  const sortedPoints = useMemo(() => {
    const points = [...(report?.points ?? [])];
    const direction = sort.direction === "asc" ? 1 : -1;
    return points.sort((a, b) => {
      const aValue = a[sort.key];
      const bValue = b[sort.key];

      if (aValue === bValue) return 0;

      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;

      if (typeof aValue === "number" && typeof bValue === "number") {
        return aValue > bValue ? direction : -direction;
      }

      return String(aValue) > String(bValue) ? direction : -direction;
    });
  }, [report?.points, sort.direction, sort.key]);

  const onSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Median" value={formatDays(summary?.median)} />
        <StatCard label="P75" value={formatDays(summary?.p75)} />
        <StatCard label="P90" value={formatDays(summary?.p90)} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        {isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading cycle time...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !hasData ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No completed issues in this range.</p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogram} margin={{ top: 12, right: 16, left: 4, bottom: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="range" stroke="#475569" />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Bar dataKey="count" name="Issues" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <th className="px-3 py-2">
                <button className="flex items-center gap-1" onClick={() => onSort("title")}>
                  Issue
                  <span className="text-[10px] text-slate-400">{sort.key === "title" ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
                </button>
              </th>
              <th className="px-3 py-2">
                <button className="flex items-center gap-1" onClick={() => onSort("startedAt")}>
                  Started
                  <span className="text-[10px] text-slate-400">{sort.key === "startedAt" ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
                </button>
              </th>
              <th className="px-3 py-2">
                <button className="flex items-center gap-1" onClick={() => onSort("doneAt")}>
                  Done
                  <span className="text-[10px] text-slate-400">{sort.key === "doneAt" ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
                </button>
              </th>
              <th className="px-3 py-2 text-right">
                <button className="flex w-full items-center justify-end gap-1" onClick={() => onSort("cycleTimeDays")}>
                  Cycle time
                  <span className="text-[10px] text-slate-400">{sort.key === "cycleTimeDays" ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {sortedPoints.map((point) => (
              <tr key={point.issueId} className="text-slate-700 dark:text-slate-200">
                <td className="px-3 py-2 font-medium">{point.key}</td>
                <td className="px-3 py-2">{formatDate(point.startedAt)}</td>
                <td className="px-3 py-2">{formatDate(point.doneAt)}</td>
                <td className="px-3 py-2 text-right">{formatDays(point.cycleTimeDays)}</td>
              </tr>
            ))}
            {!hasData && (
              <tr>
                <td className="px-3 py-3 text-center text-sm text-slate-600 dark:text-slate-400" colSpan={4}>
                  {isLoading ? "Loading..." : error ? "Unable to load cycle time" : "No completed issues in this range"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
