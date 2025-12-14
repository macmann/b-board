"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ReportsFilterValue } from "./ReportsFilters";

type VelocitySprint = {
  id: string;
  name: string;
  endDate: string;
  committedPoints: number;
  completedPoints: number;
  spilloverPoints: number;
};

type VelocityTrendResponse = {
  sprints: VelocitySprint[];
};

type VelocityTrendChartProps = {
  filters: ReportsFilterValue;
};

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

export default function VelocityTrendChart({ filters }: VelocityTrendChartProps) {
  const [data, setData] = useState<VelocityTrendResponse>({ sprints: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.projectId && filters.projectId !== "all") {
      params.set("projectId", filters.projectId);
    }

    const query = params.toString();
    const url = `/api/reports/velocity-trend${query ? `?${query}` : ""}`;

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Unable to load velocity trend.");
        }

        return response.json();
      })
      .then((payload: VelocityTrendResponse) => {
        setData(payload);
      })
      .catch((err: Error) => {
        setError(err.message);
        setData({ sprints: [] });
      })
      .finally(() => setIsLoading(false));
  }, [filters.projectId]);

  const chartData = useMemo(() => {
    const sorted = [...data.sprints].sort((a, b) => {
      const aDate = a.endDate ? new Date(a.endDate).getTime() : 0;
      const bDate = b.endDate ? new Date(b.endDate).getTime() : 0;
      return aDate - bDate;
    });

    let runningTotal = 0;

    return sorted.map((sprint, index) => {
      runningTotal += sprint.completedPoints;
      const avgVelocity = Math.round(runningTotal / (index + 1));

      return {
        ...sprint,
        averageVelocity: avgVelocity,
        label: sprint.name,
      };
    });
  }, [data.sprints]);

  const kpis = useMemo(() => {
    const recent = data.sprints.slice(0, 5);
    const best = data.sprints.reduce(
      (top, sprint) =>
        sprint.completedPoints > (top?.completedPoints ?? -Infinity) ? sprint : top,
      null as VelocitySprint | null
    );
    const worst = data.sprints.reduce(
      (bottom, sprint) =>
        sprint.completedPoints < (bottom?.completedPoints ?? Infinity) ? sprint : bottom,
      null as VelocitySprint | null
    );

    return {
      averageVelocity: average(recent.map((sprint) => sprint.completedPoints)),
      bestSprint: best ? { name: best.name, value: best.completedPoints } : null,
      worstSprint: worst ? { name: worst.name, value: worst.completedPoints } : null,
    };
  }, [data.sprints]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-950 md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Avg velocity (last 5)
          </p>
          <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {kpis.averageVelocity || "–"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Best sprint
          </p>
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {kpis.bestSprint ? `${kpis.bestSprint.name} (${kpis.bestSprint.value})` : "–"}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Worst sprint
          </p>
          <p className="text-2xl font-semibold text-amber-600 dark:text-amber-400">
            {kpis.worstSprint ? `${kpis.worstSprint.name} (${kpis.worstSprint.value})` : "–"}
          </p>
        </div>
      </div>

      <div className="min-h-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading velocity...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No completed sprints yet. Finish a sprint to see velocity trends.
          </p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 16, right: 16, left: 8, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#475569" />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="completedPoints"
                  name="Completed"
                  fill="#0ea5e9"
                  stackId="points"
                />
                <Bar
                  dataKey="spilloverPoints"
                  name="Spillover"
                  fill="#f59e0b"
                  stackId="points"
                />
                <Line
                  type="monotone"
                  dataKey="averageVelocity"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  name="Avg velocity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
