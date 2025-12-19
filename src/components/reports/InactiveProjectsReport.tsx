"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

const typeLabels = {
  issue_created: "Issue created",
  issue_updated: "Issue updated",
  standup: "Standup", 
} as const;

type ActivityType = keyof typeof typeLabels;

type InactiveProject = {
  projectId: string;
  projectName: string;
  lastActivityAt: string | null;
  lastActivityType: ActivityType | null;
};

type InactiveProjectsResponse = {
  inactiveProjects: InactiveProject[];
  inactiveDays: number;
};

type InactiveProjectsReportProps = {
  filters: ReportsFilterValue;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "No activity yet";

  const parsed = new Date(value);
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatGap = (value: string | null) => {
  if (!value) return "–";

  const parsed = new Date(value);
  const msInDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((Date.now() - parsed.getTime()) / msInDay);
  return `${Math.max(days, 0)}d ago`;
};

export default function InactiveProjectsReport({
  filters,
}: InactiveProjectsReportProps) {
  const [inactiveDays, setInactiveDays] = useState(14);
  const [data, setData] = useState<InactiveProjectsResponse | null>(null);
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
      inactiveDays: inactiveDays.toString(),
    });

    fetch(`/api/reports/inactive-projects?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load inactive projects");
        }
        return (await response.json()) as InactiveProjectsResponse;
      })
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to fetch inactive projects data"
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.projectId, inactiveDays]);

  const inactiveCount = data?.inactiveProjects.length ?? 0;
  const medianGap = useMemo(() => {
    if (!data || data.inactiveProjects.length === 0) return "–";

    const gaps = data.inactiveProjects
      .map((project) => new Date(project.lastActivityAt ?? 0).getTime())
      .sort((a, b) => a - b);

    const midpoint = Math.floor(gaps.length / 2);

    const medianValue =
      gaps.length % 2 === 0
        ? (gaps[midpoint - 1] + gaps[midpoint]) / 2
        : gaps[midpoint];

    if (medianValue <= 0) return "–";

    const days = Math.floor((Date.now() - medianValue) / (1000 * 60 * 60 * 24));
    return `${Math.max(days, 0)}d`;
  }, [data]);

  const hasResults = inactiveCount > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Inactive projects
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {loading && !data ? "–" : inactiveCount}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No movement in the last {inactiveDays} days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Inactivity window (days)
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Adjust the lookback period
                </p>
              </div>
              <input
                type="number"
                min={1}
                value={inactiveDays}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setInactiveDays(Number.isNaN(next) ? 1 : Math.max(1, next));
                }}
                className="h-10 w-20 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Typical gap
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {medianGap}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Median days since last activity</p>
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
            Loading inactive projects…
          </CardContent>
        </Card>
      )}

      {data && !hasResults && !loading && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-10 text-center text-sm text-slate-600 dark:text-slate-300">
            All projects have recent activity within the selected window.
          </CardContent>
        </Card>
      )}

      {hasResults && data && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Inactive projects
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Projects with no issues created or updated and no standups in the last {data.inactiveDays} days.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                Governance alert
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Last activity</th>
                    <th className="px-3 py-2">Activity type</th>
                    <th className="px-3 py-2">Gap</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {data.inactiveProjects.map((project) => (
                    <tr key={project.projectId} className="text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-50">
                        {project.projectName}
                      </td>
                      <td className="px-3 py-2">{formatDateTime(project.lastActivityAt)}</td>
                      <td className="px-3 py-2">
                        {project.lastActivityType
                          ? typeLabels[project.lastActivityType]
                          : "No activity"}
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatGap(project.lastActivityAt)}</td>
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
