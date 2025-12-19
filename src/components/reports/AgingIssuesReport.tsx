"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

type AgingIssue = {
  key: string;
  title: string;
  status: string;
  assignee: string | null;
  ageDays: number;
  project: string;
  daysSinceUpdate?: number;
};

type AgingIssuesResponse = {
  staleCount: number;
  staleIssues: AgingIssue[];
};

type AgingIssuesReportProps = {
  filters: ReportsFilterValue;
};

export default function AgingIssuesReport({ filters }: AgingIssuesReportProps) {
  const [thresholdDays, setThresholdDays] = useState(14);
  const [data, setData] = useState<AgingIssuesResponse | null>(null);
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
      thresholdDays: thresholdDays.toString(),
    });

    fetch(`/api/reports/aging-issues?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load aging issues");
        }
        return (await response.json()) as AgingIssuesResponse;
      })
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to fetch aging issues data"
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.projectId, thresholdDays]);

  const oldestAge = useMemo(() => data?.staleIssues[0]?.ageDays ?? "–", [data]);
  const hasResults = (data?.staleIssues.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Stale issues
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data?.staleCount ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Older than {thresholdDays} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Oldest item
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{oldestAge}d</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Time since created</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Threshold (days)
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Adjust stale definition
                </p>
              </div>
              <input
                type="number"
                min={1}
                value={thresholdDays}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setThresholdDays(Number.isNaN(next) ? 1 : Math.max(1, next));
                }}
                className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
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
            Loading aging issues…
          </CardContent>
        </Card>
      )}

      {data && !hasResults && !loading && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-10 text-center text-sm text-slate-600 dark:text-slate-300">
            No stale issues for the selected filters.
          </CardContent>
        </Card>
      )}

      {hasResults && data && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Aging issues table
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Open items sorted by age in descending order.
                </p>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                Aging risk
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">Key</th>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Assignee</th>
                    <th className="px-3 py-2">Age (days)</th>
                    <th className="px-3 py-2">Project</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.staleIssues.map((issue) => (
                    <tr key={`${issue.project}-${issue.key}`} className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2 font-mono text-xs font-semibold uppercase text-indigo-600 dark:text-indigo-300">
                        {issue.key}
                      </td>
                      <td className="px-3 py-2">{issue.title}</td>
                      <td className="px-3 py-2">{issue.status.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2">{issue.assignee ?? "Unassigned"}</td>
                      <td className="px-3 py-2 font-semibold">{issue.ageDays}</td>
                      <td className="px-3 py-2">{issue.project}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
