"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

type ProjectStatusRow = {
  projectId: string;
  projectName: string;
  status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "NO_DATA";
  healthScore: number | null;
  medianLeadTimeDays: number | null;
  openBlockers: number;
};

type ProjectStatusOverviewResponse = {
  summary: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    avgHealthScore: number | null;
  };
  rows: ProjectStatusRow[];
  aiObservation: string | null;
};

const statusLabel: Record<ProjectStatusRow["status"], string> = {
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  OFF_TRACK: "Off track",
  NO_DATA: "No data",
};

const statusColor: Record<ProjectStatusRow["status"], string> = {
  ON_TRACK: "text-emerald-600",
  AT_RISK: "text-amber-600",
  OFF_TRACK: "text-rose-600",
  NO_DATA: "text-slate-500",
};

const formatLeadTime = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}d`;

const formatHealth = (value: number | null) =>
  value === null ? "—" : `${value}`;

type ProjectStatusOverviewReportProps = {
  filters: ReportsFilterValue;
};

export default function ProjectStatusOverviewReport({
  filters,
}: ProjectStatusOverviewReportProps) {
  const [data, setData] = useState<ProjectStatusOverviewResponse | null>(null);
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

    fetch(`/api/reports/project-status-overview?${queryString}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Unable to load report");
        }

        return response.json();
      })
      .then((payload: ProjectStatusOverviewResponse) => {
        setData(payload);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Unable to load report");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const observation =
    data?.aiObservation ??
    (error ? null : "No portfolio observation available (insufficient data).");

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              On track
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? data.summary.onTrack : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Projects meeting plan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">At risk</p>
            <p className="text-3xl font-semibold text-amber-600 dark:text-amber-400">
              {data ? data.summary.atRisk : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Needs intervention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Off track</p>
            <p className="text-3xl font-semibold text-rose-600 dark:text-rose-400">
              {data ? data.summary.offTrack : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Escalations required</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Avg. health score
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {data ? formatHealth(data.summary.avgHealthScore) : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Across selected portfolio</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Project status overview</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Aggregated status, delivery posture, and blockers without assuming a shared sprint cadence.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Portfolio scope
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="grid grid-cols-6 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              <span className="col-span-2">Project</span>
              <span>Status</span>
              <span>Health</span>
              <span>Lead time</span>
              <span>Open blockers</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && (
                <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Loading report data…</div>
              )}
              {error && (
                <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-semibold text-slate-900 dark:text-slate-50">No data for selected filters</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    Try expanding the date range or selecting a different project.
                  </p>
                </div>
              )}
              {rows.map((project) => (
                <div
                  key={project.projectId}
                  className="grid grid-cols-6 items-center px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
                >
                  <div className="col-span-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{project.projectName}</p>
                  </div>
                  <div className={`font-semibold ${statusColor[project.status]}`}>
                    {statusLabel[project.status]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatHealth(project.healthScore)}</span>
                      {project.healthScore !== null && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold">{formatLeadTime(project.medianLeadTimeDays)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">median to done</p>
                  </div>
                  <div>
                    <p className="font-semibold">{project.openBlockers}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">active blockers</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-50">AI portfolio observation</p>
            <p className="mt-1">
              {observation || "No portfolio observation available (insufficient data)."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
