"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

type UserSummary = {
  userId: string;
  name: string;
  email: string | null;
  updateCount: number;
  lastUpdate: string | null;
};

type UserAdoptionResponse = {
  activeUsers: number;
  totalUsers: number;
  activeUserRate: number;
  standupCoverage: number;
  avgUpdatesPerUser: number;
  lateUpdateRate: number;
  topContributors: UserSummary[];
  users: UserSummary[];
};

type UserAdoptionMetricsReportProps = {
  filters: ReportsFilterValue;
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatDate = (value: string | null) => value ?? "—";

const formatNumber = (value: number) =>
  Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, "") : "—";

export default function UserAdoptionMetricsReport({
  filters,
}: UserAdoptionMetricsReportProps) {
  const [data, setData] = useState<UserAdoptionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", filters.dateFrom);
    params.set("to", filters.dateTo);
    params.set("projectId", filters.projectId);
    return params.toString();
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/reports/user-adoption?${queryString}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Unable to load user adoption report");
        }

        return response.json();
      })
      .then((payload: UserAdoptionResponse) => {
        setData(payload);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Unable to load report");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const users = data?.users ?? [];
  const topContributors = data?.topContributors ?? [];
  const hasUpdates = users.some((user) => user.updateCount > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-5">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Active users
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? data.activeUsers : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Submitted at least one standup</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Active user rate
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? formatPercent(data.activeUserRate) : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Share of scoped members who posted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Standup coverage
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? formatPercent(data.standupCoverage) : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Weekdays with at least one update</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Avg. updates / user
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? formatNumber(data.avgUpdatesPerUser) : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Across scoped members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Late updates
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? formatPercent(data.lateUpdateRate) : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Posted after noon</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">User adoption</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Engagement signals across standups: reach, coverage, and responsiveness.
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              Standup activity
            </div>
          </div>

          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Loading report data…</div>
          )}
          {error && (
            <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          )}
          {!isLoading && !error && !hasUpdates && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">No standups in this range</p>
              <p className="text-slate-600 dark:text-slate-400">
                Try expanding the date range or choosing a different project to see activity.
              </p>
            </div>
          )}

          {!isLoading && !error && hasUpdates && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-3 lg:col-span-1">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Top contributors
                  </p>
                  {topContributors.length === 0 && (
                    <p className="text-sm text-slate-600 dark:text-slate-400">No updates yet.</p>
                  )}
                  <ul className="mt-2 space-y-3">
                    {topContributors.map((user) => (
                      <li key={user.userId} className="flex items-center justify-between text-sm text-slate-800 dark:text-slate-100">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-50">{user.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Last: {formatDate(user.lastUpdate)}</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          {user.updateCount} update{user.updateCount === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                    <span>User</span>
                    <span className="text-right">Updates</span>
                    <span className="text-right">Last update</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map((user) => (
                      <div
                        key={user.userId}
                        className="grid grid-cols-3 items-center px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
                      >
                        <div className="truncate">
                          <p className="font-semibold text-slate-900 dark:text-slate-50">{user.name}</p>
                          {user.email && (
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                          )}
                        </div>
                        <span className="text-right font-semibold">{user.updateCount}</span>
                        <span className="text-right text-slate-600 dark:text-slate-400">{formatDate(user.lastUpdate)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
