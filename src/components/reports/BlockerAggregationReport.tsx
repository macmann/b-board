"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "../ui/Card";
import EmptyReportState from "./EmptyReportState";
import type { ReportsFilterValue } from "./ReportsFilters";

type BlockerAggregationResponse = {
  themes: Array<{ theme: ThemeKey; count: number; examples: string[] }>;
  topBlockers: Array<{ text: string; count: number }>;
  projectsWithMostBlockers: Array<{
    projectId: string;
    projectName: string;
    count: number;
  }>;
};

type ThemeKey =
  | "AUTH"
  | "DEPLOYMENT"
  | "ENV"
  | "API"
  | "DB"
  | "UI"
  | "PEOPLE"
  | "PROCESS"
  | "OTHER";

type BlockerAggregationReportProps = {
  filters: ReportsFilterValue;
};

const themeDescriptions: Record<ThemeKey, string> = {
  AUTH: "Authentication, login, and token issues",
  DEPLOYMENT: "Release, pipeline, and rollout blockers",
  ENV: "Environment and configuration problems",
  API: "External and internal API faults",
  DB: "Database and query issues",
  UI: "Frontend and presentation gaps",
  PEOPLE: "Awaiting people, approvals, or coordination",
  PROCESS: "Process, ceremonies, and sequencing",
  OTHER: "Miscellaneous blockers",
};

const formatTheme = (theme: ThemeKey) => theme.charAt(0) + theme.slice(1).toLowerCase();

export default function BlockerAggregationReport({
  filters,
}: BlockerAggregationReportProps) {
  const [data, setData] = useState<BlockerAggregationResponse | null>(null);
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

    fetch(`/api/reports/blocker-aggregation?${queryString}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Unable to load blocker aggregation");
        }

        return response.json();
      })
      .then((payload: BlockerAggregationResponse) => setData(payload))
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Unable to load blocker aggregation");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const totalBlockers = data?.themes.reduce((sum, theme) => sum + theme.count, 0) ?? 0;
  const showEmptyState = !isLoading && !error && totalBlockers === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Blocker occurrences
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totalBlockers || "–"}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Counts themes and dependencies across projects
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Themes</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{data?.themes.length ?? "–"}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Keyword buckets across the window</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Projects reporting blockers
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data?.projectsWithMostBlockers.length ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Sorted by blocker frequency</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Blocker aggregation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Themes and repeated blockers from standups to target systemic fixes.
              </p>
            </div>
            <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
              Standup blockers
            </div>
          </div>

          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Loading blocker aggregation…</div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          )}

          {showEmptyState && (
            <EmptyReportState
              title="No blockers reported"
              description="Adjust the timeframe or pick another project to surface blocker themes and repeats."
            />
          )}

          {!isLoading && !error && !showEmptyState && data && (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Themes</p>
                  <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                    {data.themes.map((theme) => (
                      <div key={theme.theme} className="px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-50">
                              {formatTheme(theme.theme)} ({theme.count})
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {themeDescriptions[theme.theme]}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700 dark:text-slate-200">
                          {theme.examples.map((example, index) => (
                            <span
                              key={`${theme.theme}-${index}`}
                              className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800"
                            >
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Top repeated blockers</p>
                    <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                      {data.topBlockers.map((blocker) => (
                        <div key={blocker.text} className="flex items-center justify-between px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                          <p className="max-w-xl truncate" title={blocker.text}>
                            {blocker.text}
                          </p>
                          <span className="font-semibold text-slate-900 dark:text-slate-50">{blocker.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Projects with most blockers</p>
                    <div className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                      {data.projectsWithMostBlockers.map((project) => (
                        <div key={project.projectId} className="flex items-center justify-between px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-50">{project.projectName}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{project.projectId}</p>
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-50">{project.count}</span>
                        </div>
                      ))}
                    </div>
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
