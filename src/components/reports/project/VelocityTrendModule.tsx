"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VelocityPoint } from "@/lib/reports/dto";
import {
  areReportFiltersEqual,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";

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

type VelocityTrendModuleProps = {
  projectId: string;
  initialFilters: ReportFilters;
  sprints: SprintOption[];
};

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "–";

export default function VelocityTrendModule({
  projectId,
  initialFilters,
  sprints,
}: VelocityTrendModuleProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [data, setData] = useState<VelocityPoint[] | null>(null);
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

    fetch(`/api/projects/${projectId}/reports/velocity?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load velocity data.");
        }

        return body?.data as VelocityPoint[];
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

  const sortedData = useMemo(
    () =>
      [...(data ?? [])].sort((a, b) => {
        const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
        return aDate - bDate;
      }),
    [data]
  );

  const averages = useMemo(() => {
    const recent = sortedData.slice(-3);
    return {
      lastThree: average(recent.map((point) => point.completedPoints)),
      overall: average(sortedData.map((point) => point.completedPoints)),
    };
  }, [sortedData]);

  const hasSprints = sprints.length > 0;
  const hasSeries = (sortedData?.length ?? 0) > 0;
  const showEmptyState = !hasSprints;
  const showNoDataState = !showEmptyState && !hasSeries && !isLoading && !error;

  const chartData = useMemo(
    () =>
      sortedData.map((point) => ({
        name: point.sprintName,
        completedPoints: point.completedPoints,
      })),
    [sortedData]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatPill
          label="Average velocity (last 3)"
          value={hasSeries ? averages.lastThree : "–"}
        />
        <StatPill label="Average velocity (all)" value={hasSeries ? averages.overall : "–"} />
        <StatPill
          label="Sprints counted"
          value={hasSeries ? sortedData.length : hasSprints ? "0" : "–"}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        {isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading velocity...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : showEmptyState ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Add a sprint to start tracking velocity over time.
          </p>
        ) : showNoDataState ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No completed work in this range.</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#475569" interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Legend />
                <Bar dataKey="completedPoints" name="Completed points" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead>
            <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <th className="px-3 py-2">Sprint</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2 text-right">Completed issues</th>
              <th className="px-3 py-2 text-right">Completed points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            {sortedData.map((point) => (
              <tr key={point.sprintId} className="text-slate-700 dark:text-slate-200">
                <td className="px-3 py-2 font-medium">{point.sprintName}</td>
                <td className="px-3 py-2">{formatDate(point.startDate)}</td>
                <td className="px-3 py-2">{formatDate(point.endDate)}</td>
                <td className="px-3 py-2 text-right">{point.completedIssues}</td>
                <td className="px-3 py-2 text-right">{point.completedPoints}</td>
              </tr>
            ))}
            {hasSeries ? null : (
              <tr>
                <td className="px-3 py-3 text-center text-sm text-slate-600 dark:text-slate-400" colSpan={5}>
                  {isLoading
                    ? "Loading..."
                    : error
                      ? "Unable to load velocity"
                      : showEmptyState
                        ? "Add a sprint to start tracking velocity"
                        : "No completed work in this range"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
