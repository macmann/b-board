"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ReportsFilterValue } from "./ReportsFilters";

const formatDate = (date: string | null | undefined) =>
  date ? new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

type BurndownPoint = {
  date: string;
  remainingPoints: number;
  completedPoints: number;
};

type SprintSummary = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

type BurndownResponse = {
  sprint: SprintSummary;
  pointsTotal: number;
  series: BurndownPoint[];
};

type SprintBurndownChartProps = {
  filters: ReportsFilterValue;
};

export default function SprintBurndownChart({
  filters,
}: SprintBurndownChartProps) {
  const [data, setData] = useState<BurndownResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.sprintId) {
      params.set("sprintId", filters.sprintId);
    }

    if (filters.projectId && filters.projectId !== "all") {
      params.set("projectId", filters.projectId);
    }

    const query = params.toString();
    const url = `/api/reports/sprint-burndown${query ? `?${query}` : ""}`;

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Unable to load burndown data.");
        }

        return response.json();
      })
      .then((payload: BurndownResponse) => {
        setData(payload);
      })
      .catch((err: Error) => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [filters.projectId, filters.sprintId]);

  const latestStats = useMemo(() => {
    if (!data) {
      return { completed: 0, remaining: 0, completionPct: 0 };
    }

    const latestPoint = data.series.at(-1) ?? null;
    const completed = latestPoint?.completedPoints ?? 0;
    const remaining = latestPoint?.remainingPoints ?? data.pointsTotal ?? 0;
    const completionPct = data.pointsTotal
      ? Math.round((completed / data.pointsTotal) * 100)
      : 0;

    return { completed, remaining, completionPct };
  }, [data]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sprint
          </p>
          <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {data?.sprint.name ?? "Active sprint"}
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {data?.sprint.startDate && data?.sprint.endDate
              ? `${formatDate(data.sprint.startDate)} – ${formatDate(data.sprint.endDate)}`
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-center dark:bg-slate-950 lg:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total points
            </p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {data?.pointsTotal ?? "–"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Completed
            </p>
            <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
              {latestStats.completed}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Remaining
            </p>
            <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {latestStats.remaining}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Completion %
            </p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {latestStats.completionPct}%
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading burndown...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !data ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose a project or sprint to view burndown data.
          </p>
        ) : data.series.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No burndown data for this sprint yet.
          </p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.series}
                margin={{ top: 16, right: 16, left: 8, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#475569" />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="remainingPoints"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Remaining"
                />
                <Line
                  type="monotone"
                  dataKey="completedPoints"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Completed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
