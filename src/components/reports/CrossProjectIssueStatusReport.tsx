"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

import type { IssueStatus } from "@/lib/prismaEnums";

type CrossProjectStatusResponse = {
  totalsByStatus: Record<IssueStatus, number>;
  projects: Array<{
    projectId: string;
    projectName: string;
    countsByStatus: Record<IssueStatus, number>;
  }>;
};

type CrossProjectIssueStatusReportProps = {
  filters: ReportsFilterValue;
};

const STATUS_CONFIG: Array<{
  key: IssueStatus;
  label: string;
  color: string;
  description: string;
}> = [
  {
    key: "TODO",
    label: "Todo",
    color: "#cbd5e1",
    description: "Planned items",
  },
  {
    key: "IN_PROGRESS",
    label: "In progress",
    color: "#38bdf8",
    description: "Actively being worked",
  },
  {
    key: "IN_REVIEW",
    label: "In review",
    color: "#a855f7",
    description: "Awaiting acceptance",
  },
  {
    key: "DONE",
    label: "Done",
    color: "#22c55e",
    description: "Completed",
  },
];

export default function CrossProjectIssueStatusReport({
  filters,
}: CrossProjectIssueStatusReportProps) {
  const [data, setData] = useState<CrossProjectStatusResponse | null>(null);
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

    fetch(`/api/reports/cross-project-status?${queryString}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Unable to load cross-project status");
        }

        return response.json();
      })
      .then((payload: CrossProjectStatusResponse) => {
        setData(payload);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Unable to load report");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const totals = data?.totalsByStatus ?? null;
  const projects = data?.projects ?? [];

  const chartData = useMemo(() => {
    if (!projects.length) return [] as Array<Record<string, number | string>>;

    return projects.map((project) => ({
      name: project.projectName,
      ...STATUS_CONFIG.reduce((acc, status) => {
        acc[status.key] = project.countsByStatus[status.key] ?? 0;
        return acc;
      }, {} as Record<IssueStatus, number>),
    }));
  }, [projects]);

  const totalIssues = STATUS_CONFIG.reduce(
    (sum, status) => sum + (totals?.[status.key] ?? 0),
    0
  );

  const showEmptyState = !isLoading && !error && totalIssues === 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        {STATUS_CONFIG.map((status) => (
          <Card key={status.key}>
            <CardContent className="space-y-1 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {status.label}
              </p>
              <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
                {totals ? totals[status.key] : "—"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{status.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Issue status distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cross-project mix of backlog, in-progress, and completed work for the selected window.
              </p>
            </div>
            <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              Portfolio load
            </div>
          </div>

          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Loading issue status…</div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          )}

          {showEmptyState && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">No issues found</p>
              <p className="text-slate-600 dark:text-slate-400">
                Adjust the timeframe or project filter to include issues created before the end date.
              </p>
            </div>
          )}

          {!isLoading && !error && !showEmptyState && (
            <div className="space-y-4">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#475569" interval={0} angle={-12} textAnchor="end" height={80} />
                    <YAxis allowDecimals={false} stroke="#475569" />
                    <Tooltip />
                    <Legend />
                    {STATUS_CONFIG.map((status) => (
                      <Bar
                        key={status.key}
                        dataKey={status.key}
                        stackId="issues"
                        fill={status.color}
                        name={status.label}
                        radius={[6, 6, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-[1.2fr_repeat(4,0.8fr)] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <span>Project</span>
                  {STATUS_CONFIG.map((status) => (
                    <span key={status.key} className="text-right">
                      {status.label}
                    </span>
                  ))}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="grid grid-cols-[1.2fr_repeat(4,0.8fr)] items-center bg-slate-50/60 px-4 py-3 text-sm font-semibold text-slate-900 dark:bg-slate-900/60 dark:text-slate-50">
                    <span>Totals</span>
                    {STATUS_CONFIG.map((status) => (
                      <span key={status.key} className="text-right">
                        {totals?.[status.key] ?? 0}
                      </span>
                    ))}
                  </div>
                  {projects.map((project) => (
                    <div
                      key={project.projectId}
                      className="grid grid-cols-[1.2fr_repeat(4,0.8fr)] items-center px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-50">{project.projectName}</span>
                      {STATUS_CONFIG.map((status) => (
                        <span key={status.key} className="text-right">
                          {project.countsByStatus[status.key] ?? 0}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
