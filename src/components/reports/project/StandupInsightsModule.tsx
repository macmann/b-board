"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import type { StandupInsight, StandupInsightsReport, StandupSignal } from "@/lib/reports/dto";
import {
  areReportFiltersEqual,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";

const MAX_SIGNAL_BADGES = 8;

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const signalTypeLabel: Record<StandupSignal["signal_type"], string> = {
  MISSING_STANDUP: "Missing standup",
  PERSISTENT_BLOCKER: "Persistent blocker",
  STALE_WORK: "Stale work",
  LOW_CONFIDENCE: "Low confidence",
};

const severityClass: Record<StandupSignal["severity"], string> = {
  low: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
  medium:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-200",
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
};

const severityWeight: Record<StandupSignal["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
  </div>
);

type StandupInsightsModuleProps = {
  projectId: string;
  initialFilters: ReportFilters;
};

export default function StandupInsightsModule({
  projectId,
  initialFilters,
}: StandupInsightsModuleProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [data, setData] = useState<StandupInsightsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<StandupInsight | null>(null);

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

    fetch(`/api/projects/${projectId}/reports/standup-insights?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load standup insights.");
        }

        return (body?.data ?? {
          daily: [],
          signals: [],
          signalDefinitions: {},
        }) as StandupInsightsReport;
      })
      .then((payload) => setData(payload))
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setData({
          daily: [],
          signals: [],
          signalDefinitions: {} as StandupInsightsReport["signalDefinitions"],
        });
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, projectId]);

  const chartData = useMemo(
    () =>
      (data?.daily ?? []).map((entry) => ({
        date: formatDateLabel(entry.date),
        updates: entry.updatesCount,
        blockers: entry.blockersCount,
        dependencies: entry.dependenciesCount,
      })),
    [data?.daily]
  );

  const totals = useMemo(() => {
    const base = { updates: 0, blockers: 0, dependencies: 0 };
    return (data?.daily ?? []).reduce(
      (acc, entry) => ({
        updates: acc.updates + entry.updatesCount,
        blockers: acc.blockers + entry.blockersCount,
        dependencies: acc.dependencies + entry.dependenciesCount,
      }),
      base
    );
  }, [data?.daily]);

  const signals = data?.signals ?? [];
  const hasSeries = (data?.daily.length ?? 0) > 0;

  const groupedSignals = useMemo(() => {
    const groups = new Map<StandupSignal["signal_type"], { signals: StandupSignal[]; maxSeverity: StandupSignal["severity"] }>();

    for (const signal of signals) {
      const existing = groups.get(signal.signal_type);
      if (!existing) {
        groups.set(signal.signal_type, { signals: [signal], maxSeverity: signal.severity });
        continue;
      }

      existing.signals.push(signal);
      if (severityWeight[signal.severity] > severityWeight[existing.maxSeverity]) {
        existing.maxSeverity = signal.severity;
      }
    }

    return Array.from(groups.entries())
      .map(([signalType, group]) => {
        const representative = [...group.signals].sort((a, b) =>
          severityWeight[b.severity] - severityWeight[a.severity] || a.since.localeCompare(b.since)
        )[0];

        return {
          signalType,
          count: group.signals.length,
          severity: group.maxSeverity,
          representative,
        };
      })
      .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || b.count - a.count)
      .slice(0, MAX_SIGNAL_BADGES);
  }, [signals]);

  const jumpToEvidence = (signal: StandupSignal) => {
    const targetId = signal.evidence_entry_ids[0];
    if (!targetId) return;

    const element = document.getElementById(`entry-${targetId}`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total updates" value={hasSeries ? totals.updates : "–"} />
        <StatCard label="Blockers reported" value={hasSeries ? totals.blockers : "–"} />
        <StatCard
          label="Dependencies flagged"
          value={hasSeries ? totals.dependencies : "–"}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Signals</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Deterministic pre-nudging risk flags (UTC cutoff + defined thresholds).
          </p>
        </div>
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap gap-2">
            {groupedSignals.length > 0 ? (
              groupedSignals.map((group) => (
                <button
                  key={group.signalType}
                  type="button"
                  onClick={() => jumpToEvidence(group.representative)}
                  disabled={group.representative.evidence_entry_ids.length === 0}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${severityClass[group.severity]}`}
                >
                  {signalTypeLabel[group.signalType]} ({group.count}) · since {formatDateLabel(group.representative.since)}
                </button>
              ))
            ) : (
              <p className="px-1 text-sm text-slate-600 dark:text-slate-400">No signals detected in this date range.</p>
            )}
          </div>
          {data?.signalDefinitions && Object.keys(data.signalDefinitions).length > 0 && (
            <ul className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
              {Object.entries(data.signalDefinitions).map(([type, def]) => (
                <li key={type}>
                  <span className="font-semibold">{signalTypeLabel[type as StandupSignal["signal_type"]]}:</span>{" "}
                  {def.threshold} — {def.description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        {isLoading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading standup insights...</p>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : !hasSeries ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">No standup activity in this range.</p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 12, left: 4, bottom: 12 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#475569" tickFormatter={(value) => value} />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="updates"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  name="Updates"
                />
                <Line
                  type="monotone"
                  dataKey="blockers"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  name="Blockers"
                />
                <Line
                  type="monotone"
                  dataKey="dependencies"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2 }}
                  name="Dependencies"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Daily breakdown</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Track standup participation and blockers by day.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Updates
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Blockers
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Dependencies
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Top blockers
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  AI summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {(data?.daily ?? []).map((entry) => (
                <tr key={entry.date}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-900 dark:text-slate-50">
                    {formatDateLabel(entry.date)}
                    <div className="sr-only">
                      {entry.entryIds.map((entryId) => (
                        <span key={entryId} id={`entry-${entryId}`}>
                          {entryId}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-50">{entry.updatesCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-50">{entry.blockersCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-50">{entry.dependenciesCount}</td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    {entry.topBlockers.length > 0 ? entry.topBlockers.join(", ") : "–"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    <button
                      type="button"
                      onClick={() => entry.hasAiSummary && setActiveSummary(entry)}
                      disabled={!entry.hasAiSummary}
                      className="inline-flex items-center rounded-md border border-slate-200 px-3 py-1 text-sm font-medium text-primary shadow-sm transition hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 dark:border-slate-800 dark:text-primary"
                    >
                      {entry.hasAiSummary ? "View summary" : "No summary"}
                    </button>
                    {entry.summaryExcerpt && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.summaryExcerpt}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog.Root open={Boolean(activeSummary)} onOpenChange={(open) => !open && setActiveSummary(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl focus:outline-none dark:bg-slate-900">
            <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Standup summary for {activeSummary ? formatDateLabel(activeSummary.date) : ""}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-slate-500 dark:text-slate-400">
              AI-generated recap of the team&apos;s updates and blockers.
            </Dialog.Description>
            <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              {activeSummary?.summary ? (
                <MarkdownRenderer content={activeSummary.summary} className="prose prose-sm max-w-none dark:prose-invert" />
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">No summary available for this day.</p>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  Close
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
