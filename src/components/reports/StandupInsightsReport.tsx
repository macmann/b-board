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

type DailyInsight = {
  date: string;
  updatesCount: number;
  blockersCount: number;
  dependenciesCount: number;
  summary?: string | null;
};

type TopItem = { text: string; count: number };

type MissingUpdate = { userId: string; name: string; missingDays: number };

type StandupInsightsResponse = {
  daily: DailyInsight[];
  topBlockers: TopItem[];
  topDependencies: TopItem[];
  missingUpdates: MissingUpdate[];
};

type StandupInsightsReportProps = {
  filters: ReportsFilterValue;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function StandupInsightsReport({
  filters,
}: StandupInsightsReportProps) {
  const [data, setData] = useState<StandupInsightsResponse | null>(null);
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

    const url = `/api/reports/standup-insights?${params.toString()}`;

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Unable to load standup insights.");
        }

        return response.json();
      })
      .then((payload: StandupInsightsResponse) => {
        setData(payload);
      })
      .catch((err: Error) => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  const totals = useMemo(() => {
    if (!data) {
      return {
        updates: 0,
        blockers: 0,
        dependencies: 0,
        missing: 0,
      };
    }

    return {
      updates: data.daily.reduce((sum, day) => sum + day.updatesCount, 0),
      blockers: data.daily.reduce((sum, day) => sum + day.blockersCount, 0),
      dependencies: data.daily.reduce((sum, day) => sum + day.dependenciesCount, 0),
      missing: data.missingUpdates.reduce((sum, record) => sum + record.missingDays, 0),
    };
  }, [data]);

  const summaries = useMemo(
    () => data?.daily.filter((item) => item.summary),
    [data?.daily]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["Updates", "Blockers", "Dependencies", "Missed updates"].map(
          (label, index) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                {[totals.updates, totals.blockers, totals.dependencies, totals.missing][
                  index
                ]
              }
            </p>
            {label === "Updates" && data && data.daily.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {`${Math.round(totals.updates / data.daily.length)} per day`}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Update and blocker trends
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Track how many standup updates and blockers were captured each day.
              </p>
            </div>
            {data && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {data.daily.length} days
              </div>
            )}
          </div>

          <div className="mt-4 h-80">
            {isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading trends...</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Select a date range to run the report.</p>
            ) : data.daily.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No standup entries in this range.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#475569" tickFormatter={formatDate} />
                  <YAxis allowDecimals={false} stroke="#475569" />
                  <Tooltip labelFormatter={(value) => formatDate(String(value))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="updatesCount"
                    name="Updates"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="blockersCount"
                    name="Blockers"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dependenciesCount"
                    name="Dependencies"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Missing updates</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            People who missed their standup window in the selected range.
          </p>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading attendance...</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Run the report to see who is missing updates.</p>
            ) : data.missingUpdates.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Everyone is up to date.</p>
            ) : (
              data.missingUpdates.map((record) => (
                <div
                  key={record.userId}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{record.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{record.userId}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                    {record.missingDays} day{record.missingDays === 1 ? "" : "s"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Top blockers</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Recurring blockers highlighted in team updates.
          </p>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading blockers...</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Run the report to view blockers.</p>
            ) : data.topBlockers.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No blockers reported.</p>
            ) : (
              data.topBlockers.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="text-slate-900 dark:text-slate-50">{item.text}</span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Top dependencies</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Themes where teams need help or coordination.
          </p>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Loading dependencies...</p>
            ) : error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : !data ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">Run the report to view dependencies.</p>
            ) : data.topDependencies.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No dependencies reported.</p>
            ) : (
              data.topDependencies.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <span className="text-slate-900 dark:text-slate-50">{item.text}</span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                    {item.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {summaries && summaries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">AI standup summaries</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Recap of daily AI summaries within the selected window.
          </p>

          <div className="mt-4 space-y-3">
            {summaries.map((item) => (
              <div
                key={item.date}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {formatDate(item.date)}
                </p>
                <p className="text-sm text-slate-900 dark:text-slate-100">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
