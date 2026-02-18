"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

import type { SprintGuidanceSuggestion, SprintHealthReport } from "@/lib/reports/dto";
import {
  areReportFiltersEqual,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";
import { logClient } from "@/lib/clientLogger";

type SprintHealthModuleProps = {
  projectId: string;
  initialFilters: ReportFilters;
};

const formatDateLabel = (value: string) => {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const statusClass: Record<SprintHealthReport["status"], string> = {
  GREEN: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  YELLOW: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  RED: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
};

const resolveEvidenceHref = (projectId: string, evidence: string) => {
  if (evidence.startsWith("entry:")) {
    return `/projects/${projectId}/standup?entryId=${encodeURIComponent(evidence.replace("entry:", ""))}`;
  }
  if (evidence.startsWith("issue:")) {
    return `/projects/${projectId}/backlog?issueId=${encodeURIComponent(evidence.replace("issue:", ""))}`;
  }
  if (evidence.startsWith("research:")) {
    return `/projects/${projectId}/research?itemId=${encodeURIComponent(evidence.replace("research:", ""))}`;
  }
  return null;
};

const addDaysISO = (days: number) => {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString().slice(0, 10);
};

export default function SprintHealthModule({ projectId, initialFilters }: SprintHealthModuleProps) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [data, setData] = useState<SprintHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const parsed = parseReportSearchParams(searchParams);
    if (!areReportFiltersEqual(parsed.filters, filters)) {
      setFilters(parsed.filters);
    }
  }, [filters, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      to: filters.dateTo,
      from: filters.dateFrom,
    });

    setIsLoading(true);
    setError(null);

    fetch(`/api/projects/${projectId}/reports/sprint-health?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(body?.message ?? "Unable to load sprint health.");
        }
        return body?.data as SprintHealthReport;
      })
      .then((payload) => {
        setData(payload);
        logClient("SprintHealthViewed", {
          projectId,
          healthScore: payload.healthScore,
          status: payload.status,
        });
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, projectId]);

  const allSuggestions = useMemo(
    () => [
      ...(data?.reallocationSuggestions ?? []),
      ...(data?.scopeAdjustmentSuggestions ?? []),
      ...(data?.meetingOptimizationSuggestions ?? []),
    ],
    [data]
  );

  useEffect(() => {
    if (!data) return;

    const distinct = Array.from(new Map(allSuggestions.map((item) => [item.id, item] as const)).values());
    distinct.forEach((suggestion) => {
      fetch(`/api/projects/${projectId}/reports/sprint-health/suggestions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          sprint_id: data.velocitySnapshot.sprint.id,
          suggestion_id: suggestion.id,
          suggestion_type: suggestion.type,
          viewed: true,
        }),
      }).catch(() => undefined);

      logClient("SuggestionViewed", {
        projectId,
        suggestionId: suggestion.id,
        suggestionType: suggestion.type,
      });
    });
  }, [allSuggestions, data, projectId]);

  const updateSuggestionState = async (
    suggestion: SprintGuidanceSuggestion,
    state: "ACCEPTED" | "DISMISSED" | "SNOOZED"
  ) => {
    if (!data) return;

    const dismissedUntil = state === "DISMISSED" ? addDaysISO(30) : null;
    const snoozedUntil = state === "SNOOZED" ? addDaysISO(3) : null;

    const response = await fetch(`/api/projects/${projectId}/reports/sprint-health/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: data.date,
        sprint_id: data.velocitySnapshot.sprint.id,
        suggestion_id: suggestion.id,
        suggestion_type: suggestion.type,
        state,
        dismissed_until: dismissedUntil,
        snoozed_until: snoozedUntil,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message ?? "Failed to update suggestion state.");
    }

    logClient(`Suggestion${state === "ACCEPTED" ? "Accepted" : state === "DISMISSED" ? "Dismissed" : "Snoozed"}`, {
      projectId,
      suggestionId: suggestion.id,
      suggestionType: suggestion.type,
    });

    setData((previous) => {
      if (!previous) return previous;
      const mutate = (items: SprintGuidanceSuggestion[]) =>
        items.filter((item) => item.id !== suggestion.id);

      return {
        ...previous,
        reallocationSuggestions: mutate(previous.reallocationSuggestions),
        scopeAdjustmentSuggestions: mutate(previous.scopeAdjustmentSuggestions),
        meetingOptimizationSuggestions: mutate(previous.meetingOptimizationSuggestions),
        executiveView: {
          ...previous.executiveView,
          topActions: previous.executiveView.topActions.filter((action) => action !== suggestion.recommendation),
          suggestedStructuralAdjustment:
            previous.executiveView.suggestedStructuralAdjustment === suggestion.recommendation
              ? null
              : previous.executiveView.suggestedStructuralAdjustment,
        },
      };
    });
  };

  const chartData = useMemo(
    () =>
      (data?.trend14d ?? []).map((point) => ({
        date: formatDateLabel(point.date),
        healthScore: point.healthScore,
      })),
    [data?.trend14d]
  );

  if (isLoading && !data) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Loading sprint health...</p>;
  }

  if (error && !data) {
    return <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">No sprint health data available.</p>;
  }

  const suggestionCard = (suggestion: SprintGuidanceSuggestion) => (
    <li key={suggestion.id} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
      <p className="font-medium">{suggestion.recommendation}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Reason: {suggestion.reason}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Impact: {suggestion.impactEstimate} (Score {suggestion.impactScore}/100)
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Impact basis: {suggestion.impactExplanation}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Formula: {suggestion.formulaBasis}</p>
      {suggestion.confidenceLabel ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Confidence: {suggestion.confidenceLabel}</p>
      ) : null}
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Evidence:{" "}
        {suggestion.evidence.length === 0
          ? "n/a"
          : suggestion.evidence.map((item, index) => {
              const href = resolveEvidenceHref(projectId, item);
              if (!href) {
                return <span key={`${item}-${index}`}>{index ? ", " : ""}{item}</span>;
              }
              return (
                <span key={`${item}-${index}`}>
                  {index ? ", " : ""}
                  <Link href={href} className="text-blue-600 hover:underline dark:text-blue-300">
                    {item}
                  </Link>
                </span>
              );
            })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
          onClick={() => updateSuggestionState(suggestion, "ACCEPTED").catch((err) => setError(err.message))}
        >
          Accept
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          onClick={() => updateSuggestionState(suggestion, "SNOOZED").catch((err) => setError(err.message))}
        >
          Snooze 3d
        </button>
        <button
          type="button"
          className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300"
          onClick={() => updateSuggestionState(suggestion, "DISMISSED").catch((err) => setError(err.message))}
        >
          Dismiss 30d
        </button>
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Sprint health score</h3>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[data.status]}`}>
            {data.status}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">Confidence: {data.confidenceLevel}</span>
        </div>
        <p className="mt-2 text-4xl font-semibold text-slate-900 dark:text-slate-50">{data.healthScore}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Smoothed (3-day): {data.smoothedHealthScore}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Success probability {data.probabilities.sprintSuccess}% • Spillover probability {data.probabilities.spillover}%</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Forecast confidence: {data.forecastConfidence}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Proactive guidance: {data.proactiveGuidanceEnabled ? "Enabled" : "Disabled"}</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">What should I do today?</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Today's focus</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {data.executiveView.todaysFocus.map((focus, index) => <li key={`${focus}-${index}`}>• {focus}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Top 3 risks</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {data.executiveView.topRisks.length === 0
                ? <li>• No active high-risk drivers.</li>
                : data.executiveView.topRisks.map((risk, index) => <li key={`${risk}-${index}`}>• {risk}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Top 3 actions</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
              {data.executiveView.topActions.length === 0
                ? <li>• No suggested interventions right now.</li>
                : data.executiveView.topActions.map((action, index) => <li key={`${action}-${index}`}>• {action}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Suggested structural adjustment</p>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{data.executiveView.suggestedStructuralAdjustment ?? "No structural adjustment suggested."}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">14-day trend</h3>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 6, right: 6, top: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="healthScore" stroke="#2563eb" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Suggested reallocation</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {data.reallocationSuggestions.length === 0 ? <li>No deterministic reallocation suggestion.</li> : data.reallocationSuggestions.map(suggestionCard)}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Scope adjustment</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {data.scopeAdjustmentSuggestions.length === 0 ? <li>No scope change suggestion.</li> : data.scopeAdjustmentSuggestions.map(suggestionCard)}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Meeting optimization</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {data.meetingOptimizationSuggestions.length === 0 ? <li>No meeting intervention suggested.</li> : data.meetingOptimizationSuggestions.map(suggestionCard)}
          </ul>
        </div>
      </section>
    </div>
  );
}
