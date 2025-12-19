"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

type TrendPoint = {
  periodStart: string;
  issuesDone: number;
  pointsDone: number;
};

type SprintPredictability = {
  type: "sprint";
  sprints: Array<{
    sprintId: string;
    sprintName: string;
    plannedPoints: number;
    completedPoints: number;
    completionRatio: number | null;
    startDate: string | null;
    endDate: string | null;
  }>;
};

type VolatilityPredictability = {
  type: "volatility";
  stabilityScore: number;
  volatility: number;
};

type DeliveryHealthResponse = {
  completedIssues: number;
  completedPoints: number;
  avgLeadTimeDays: number | null;
  medianLeadTimeDays: number | null;
  throughputTrend: TrendPoint[];
  predictability: SprintPredictability | VolatilityPredictability;
};

type DeliveryHealthSummaryReportProps = {
  filters: ReportsFilterValue;
};

const formatLeadTime = (value: number | null) =>
  value === null ? "–" : `${value.toFixed(1)}d`;

export default function DeliveryHealthSummaryReport({
  filters,
}: DeliveryHealthSummaryReportProps) {
  const [data, setData] = useState<DeliveryHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      from: filters.dateFrom,
      to: filters.dateTo,
      projectId: filters.projectId,
    });

    fetch(`/api/reports/delivery-health?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load delivery health data");
        }
        return (await response.json()) as DeliveryHealthResponse;
      })
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to fetch delivery health data"
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  const summary = useMemo(() => {
    if (!data) {
      return {
        completedIssues: "–",
        completedPoints: "–",
        avgLeadTime: "–",
        medianLeadTime: "–",
      };
    }

    return {
      completedIssues: data.completedIssues,
      completedPoints: data.completedPoints,
      avgLeadTime: formatLeadTime(data.avgLeadTimeDays),
      medianLeadTime: formatLeadTime(data.medianLeadTimeDays),
    };
  }, [data]);

  const isEmpty = data?.completedIssues === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Completed issues
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {summary.completedIssues}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Within the selected period</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Completed points
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {summary.completedPoints}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Story points done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Average lead time
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {summary.avgLeadTime}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Created to done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Median lead time
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {summary.medianLeadTime}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Distribution midpoint</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
            Loading delivery health…
          </CardContent>
        </Card>
      )}

      {data && isEmpty && !loading && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-10 text-center text-sm text-slate-600 dark:text-slate-300">
            No completed work in selected period.
          </CardContent>
        </Card>
      )}

      {data && !isEmpty && (
        <>
          <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    Throughput trend
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Completed issues and points bucketed by day or week for the selected range.
                  </p>
                </div>
                <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  Real data
                </div>
              </div>

              {data.throughputTrend.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.throughputTrend}
                      margin={{ top: 16, right: 16, left: 8, bottom: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="periodStart" stroke="#475569" />
                      <YAxis yAxisId="left" stroke="#475569" allowDecimals={false} />
                      <YAxis yAxisId="right" orientation="right" stroke="#475569" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="issuesDone"
                        stroke="#6366f1"
                        fill="#6366f1"
                        name="Issues completed"
                        fillOpacity={0.2}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="pointsDone"
                        stroke="#10b981"
                        fill="#10b981"
                        name="Story points"
                        fillOpacity={0.15}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  No throughput data for this window.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Predictability</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Sprint completion ratios when sprint data exists; otherwise stability based on week-to-week throughput volatility.
                </p>
              </div>

              {data.predictability.type === "sprint" ? (
                data.predictability.sprints.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                          <th className="pb-2 pr-4">Sprint</th>
                          <th className="pb-2 pr-4">Planned</th>
                          <th className="pb-2 pr-4">Completed</th>
                          <th className="pb-2 pr-4">Completion</th>
                          <th className="pb-2">Window</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.predictability.sprints.map((sprint) => (
                          <tr key={sprint.sprintId} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                            <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-100">
                              {sprint.sprintName}
                            </td>
                            <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{sprint.plannedPoints}</td>
                            <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{sprint.completedPoints}</td>
                            <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                              {sprint.completionRatio !== null
                                ? `${Math.round(sprint.completionRatio * 100)}%`
                                : "–"}
                            </td>
                            <td className="py-2 text-slate-700 dark:text-slate-200">
                              {[sprint.startDate?.slice(0, 10), sprint.endDate?.slice(0, 10)]
                                .filter(Boolean)
                                .join(" → ") || "–"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Sprints overlap this window, but none have planned work to compare.
                  </p>
                )
              ) : (
                <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 dark:text-slate-50">Stability score</span>
                    <span className="text-lg font-semibold">{Math.round(data.predictability.stabilityScore)}</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Derived from throughput volatility (std dev / mean): {data.predictability.volatility.toFixed(2)}.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
