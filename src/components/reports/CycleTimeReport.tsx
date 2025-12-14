"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ReportsFilterValue } from "./ReportsFilters";

type CycleTimeSummary = {
  medianHours: number;
  p75Hours: number;
  avgHours: number;
  sampleSize: number;
};

type CycleTimeBucket = {
  label: string;
  count: number;
};

type CycleTimeItem = {
  issueKey: string;
  title: string;
  cycleHours: number;
  completedAt: string;
};

type CycleTimeResponse = {
  summary: CycleTimeSummary;
  buckets: CycleTimeBucket[];
  items: CycleTimeItem[];
};

type CycleTimeReportProps = {
  filters: ReportsFilterValue;
};

const formatHoursAsDays = (hours: number) => {
  const days = hours / 24;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function CycleTimeReport({ filters }: CycleTimeReportProps) {
  const [data, setData] = useState<CycleTimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      from: filters.dateFrom,
      to: filters.dateTo,
    });

    if (filters.projectId && filters.projectId !== "all") {
      params.set("projectId", filters.projectId);
    }

    const url = `/api/reports/cycle-time?${params.toString()}`;

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Unable to load cycle time data.");
        }

        return response.json();
      })
      .then((payload: CycleTimeResponse) => {
        setData(payload);
      })
      .catch((err: Error) => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  const summaryCards = useMemo(() => {
    if (!data) return null;

    const { summary } = data;
    return [
      { label: "Median", value: formatHoursAsDays(summary.medianHours) },
      { label: "P75", value: formatHoursAsDays(summary.p75Hours) },
      { label: "Average", value: formatHoursAsDays(summary.avgHours) },
      { label: "Sample", value: summary.sampleSize.toString() },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards ? (
          summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {card.label}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {card.value}
              </p>
            </div>
          ))
        ) : (
          <div className="col-span-4 text-sm text-slate-600 dark:text-slate-400">
            {isLoading ? "Loading summary..." : error ?? "Choose a timeframe to see cycle time."}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Cycle time distribution</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Buckets show how long issues took from start to finish.
          </p>
          <div className="mt-4 h-72">
            {isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading distribution...</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Select a date range to run the report.</p>
            ) : data.summary.sampleSize === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No completed issues in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.buckets} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#475569" />
                  <YAxis allowDecimals={false} stroke="#475569" />
                  <Tooltip formatter={(value: number) => [`${value} issues`, "Count"]} />
                  <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Longest cycle items</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Top issues by time from start to done.
          </p>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading items...</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Run the report to see results.</p>
            ) : data.items.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No completed issues found.</p>
            ) : (
              data.items.map((item) => (
                <div
                  key={`${item.issueKey}-${item.completedAt}`}
                  className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-50">
                    <span className="font-mono text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                      {item.issueKey}
                    </span>
                    <span>{formatHoursAsDays(item.cycleHours)}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{item.title}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Completed {formatDate(item.completedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
