"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { BlockerTheme } from "@/lib/reports/dto";
import {
  areReportFiltersEqual,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

const buildActionDraft = (theme: BlockerTheme) => {
  const examples = theme.examples.map((example) => `- ${example}`).join("\n") || "- No specific examples captured";
  return `Action item: Reduce ${theme.theme.toLowerCase()} blockers\n\nProblem: ${theme.count} blocker mentions related to ${theme.theme.toLowerCase()}.\nExamples:\n${examples}\n\nNext steps:\n- Assign an owner to investigate\n- Define a mitigation or playbook\n- Add a due date and update status`;
};

const ThemeCard = ({
  theme,
  onCreate,
}: {
  theme: BlockerTheme;
  onCreate: (theme: BlockerTheme) => void;
}) => (
  <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Theme</p>
          <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">{theme.theme}</p>
        </div>
        <div className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          {theme.count} mentions
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Examples</p>
        {theme.examples.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No specific examples captured.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {theme.examples.map((example, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                <span className="leading-relaxed">{example}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>

    <button
      type="button"
      className="mt-4 inline-flex items-center justify-center rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:ring-offset-slate-900"
      onClick={() => onCreate(theme)}
    >
      Create action item
    </button>
  </div>
);

type BlockerThemesModuleProps = {
  projectId: string;
  initialFilters: ReportFilters;
};

export default function BlockerThemesModule({
  projectId,
  initialFilters,
}: BlockerThemesModuleProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [data, setData] = useState<BlockerTheme[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseReportSearchParams(searchParams);
    if (!areReportFiltersEqual(parsed.filters, filters)) {
      setFilters(parsed.filters);
    }
  }, [filters, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();

    params.set("from", filters.dateFrom);
    params.set("to", filters.dateTo);

    setIsLoading(true);
    setError(null);

    fetch(`/api/projects/${projectId}/reports/blocker-themes?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load blocker themes.");
        }

        return (body?.data ?? []) as BlockerTheme[];
      })
      .then((payload) => setData(payload))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setData([]);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, projectId]);

  const totals = useMemo(
    () =>
      (data ?? []).reduce(
        (acc, theme) => ({
          mentions: acc.mentions + theme.count,
          uniqueThemes: acc.uniqueThemes + (theme.count > 0 ? 1 : 0),
        }),
        { mentions: 0, uniqueThemes: 0 }
      ),
    [data]
  );

  const topTheme = useMemo(
    () => (data ?? []).find((theme) => theme.count > 0),
    [data]
  );

  const hasThemes = (data?.length ?? 0) > 0 && (data?.some((theme) => theme.count > 0) ?? false);

  const handleCreateAction = (theme: BlockerTheme) => {
    const draft = buildActionDraft(theme);

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(draft)
        .then(() => setToast("Draft copied to clipboard"))
        .catch(() => setToast("Unable to copy draft; try again."));
    } else {
      setToast("Clipboard unavailable. Copy the draft manually.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Blocker mentions" value={hasThemes ? totals.mentions : "–"} />
        <StatCard label="Distinct themes" value={hasThemes ? totals.uniqueThemes : "–"} />
        <StatCard label="Top theme" value={topTheme?.theme ?? "–"} />
      </div>

      {toast ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
          {toast}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recurring blockers</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Themes derived from standup blockers within the selected date range.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Analyzing blockers...</p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : !hasThemes ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No blocker themes detected for this period. Encourage the team to log blockers during standup to
              surface patterns.
            </p>
          ) : (
            (data ?? []).map((theme) => <ThemeCard key={theme.theme} theme={theme} onCreate={handleCreateAction} />)
          )}
        </div>
      </div>
    </div>
  );
}
