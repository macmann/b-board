"use client";

import { useEffect, useMemo, useState } from "react";
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

import type { SprintHealthReport } from "@/lib/reports/dto";
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
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Smoothed (3-day): {data.smoothedHealthScore}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Success probability {data.probabilities.sprintSuccess}% • Spillover probability {data.probabilities.spillover}%
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Forecast confidence: {data.forecastConfidence}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Remaining linked work: {data.velocitySnapshot.remainingLinkedWork} • Weighted remaining: {data.velocitySnapshot.weightedRemainingWork}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Completion rate/day: {data.velocitySnapshot.completionRatePerDay} • Linked work coverage: {Math.round(data.velocitySnapshot.linkedWorkCoverage * 100)}%
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Projected completion: {data.velocitySnapshot.projectedCompletionDate ? formatDateLabel(data.velocitySnapshot.projectedCompletionDate) : "n/a"}
          {data.velocitySnapshot.projectedCompletionDateSmoothed ? ` • 3d smoothed: ${formatDateLabel(data.velocitySnapshot.projectedCompletionDateSmoothed)}` : ""}
          {data.velocitySnapshot.projectedDateDeltaDays ? ` • Δ ${data.velocitySnapshot.projectedDateDeltaDays}d` : ""}
          {data.velocitySnapshot.deliveryRisk ? " • DELIVERY_RISK" : ""}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {data.velocitySnapshot.scopeChangeSummary}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Sprint: {data.velocitySnapshot.sprint.name ?? "No active sprint"}
          {data.velocitySnapshot.sprint.endDate ? ` • ends ${formatDateLabel(data.velocitySnapshot.sprint.endDate)}` : ""}
        </p>
        {data.velocitySnapshot.unweightedProjectionWarning ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {data.velocitySnapshot.projectionDefinitions.warning}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Risk delta since yesterday: {data.riskDeltaSinceYesterday >= 0 ? "+" : ""}
          {data.riskDeltaSinceYesterday} ({data.trendIndicator})
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Probability model: {data.probabilityModel.name} — {data.probabilityModel.formula}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Scoring model version: {data.scoringModelVersion} • Projection model: {data.velocitySnapshot.projectionModelVersion}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Scope rule: {data.velocitySnapshot.projectionDefinitions.remainingWorkDefinition}
        </p>
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

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk drivers</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {data.riskDrivers.length === 0 ? (
              <li>No active risk drivers.</li>
            ) : (
              data.riskDrivers.map((driver) => (
                <li key={driver.type} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                  <p className="font-medium">{driver.type} ({driver.impact})</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Evidence: {driver.evidence.length ? driver.evidence.join(", ") : "n/a"}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Scoring breakdown</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            {data.scoreBreakdown.map((item, index) => (
              <li key={`${item.reason}-${index}`} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <span>{item.reason}</span>
                <span className="font-semibold">{item.impact > 0 ? `+${item.impact}` : item.impact}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Concentration areas: {data.riskConcentrationAreas.length ? data.riskConcentrationAreas.join(", ") : "None"}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Concentration index: {data.concentrationIndex}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Confidence basis — completeness: {data.confidenceBasis.dataCompleteness}, stability: {data.confidenceBasis.signalStability}, sample: {data.confidenceBasis.sampleSize}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Normalization — blockers/member: {data.normalizedMetrics.blockerRatePerMember}, missing standup rate: {data.normalizedMetrics.missingStandupRate}, stale/task: {data.normalizedMetrics.staleWorkRatePerActiveTask}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Avg blocker resolution: {data.velocitySnapshot.avgBlockerResolutionHours ?? "n/a"}h • Avg action resolution: {data.velocitySnapshot.avgActionResolutionHours ?? "n/a"}h
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Capacity signals</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
          {data.capacitySignals.length === 0 ? (
            <li>No capacity imbalance detected.</li>
          ) : (
            data.capacitySignals.map((signal) => (
              <li key={`${signal.userId}-${signal.type}`} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
                <p className="font-medium">{signal.type} — {signal.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{signal.message}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  open:{signal.openItems} blocked:{signal.blockedItems} idleDays:{signal.idleDays} • thresholds o&gt;{signal.thresholds.openItems}, b≥{signal.thresholds.blockedItems}, idle≥{signal.thresholds.idleDays}
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
