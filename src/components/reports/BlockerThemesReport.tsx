"use client";

import { useEffect, useMemo, useState } from "react";

import { ReportsFilterValue } from "./ReportsFilters";

type ThemeResult = { theme: string; count: number; examples: string[] };

type BlockerThemesResponse = { themes: ThemeResult[] };

type BlockerThemesReportProps = { filters: ReportsFilterValue };

export default function BlockerThemesReport({
  filters,
}: BlockerThemesReportProps) {
  const [data, setData] = useState<BlockerThemesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({
      from: filters.dateFrom,
      to: filters.dateTo,
    });

    if (filters.projectId && filters.projectId !== "all") {
      params.set("projectId", filters.projectId);
    }

    const url = `/api/reports/blocker-themes?${params.toString()}`;

    setIsLoading(true);
    setError(null);

    fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message ?? "Unable to load blocker themes.");
        }

        return response.json();
      })
      .then((payload: BlockerThemesResponse) => setData(payload))
      .catch((err: Error) => {
        setError(err.message);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  const themeTotals = useMemo(() => {
    if (!data) return 0;
    return data.themes.reduce((sum, theme) => sum + theme.count, 0);
  }, [data]);

  const toggleExpanded = (theme: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(theme)) {
        next.delete(theme);
      } else {
        next.add(theme);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {["Total blockers", "Unique themes"].map((label, index) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </p>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {[themeTotals, data?.themes.length ?? 0][index]}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Blocker themes
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Click a theme to review real blocker examples.
              </p>
            </div>
            {data && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {data.themes.length} themes
              </div>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {isLoading ? (
            <p className="px-4 py-6 text-sm text-slate-600 dark:text-slate-400">
              Loading themes...
            </p>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : !data ? (
            <p className="px-4 py-6 text-sm text-slate-600 dark:text-slate-400">
              Select filters to run the report.
            </p>
          ) : data.themes.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-600 dark:text-slate-400">
              No blockers captured for this range.
            </p>
          ) : (
            data.themes.map((theme) => (
              <div key={theme.theme} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(theme.theme)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {theme.theme}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {theme.examples.length} examples
                    </p>
                  </div>
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {theme.count}
                  </div>
                </button>

                {expanded.has(theme.theme) && theme.examples.length > 0 && (
                  <ul className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    {theme.examples.map((example, index) => (
                      <li key={`${theme.theme}-${index}`} className="leading-relaxed">
                        • {example}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
