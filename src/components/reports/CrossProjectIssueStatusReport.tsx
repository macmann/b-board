"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { portfolioProjects } from "./workspaceSampleData";

type CrossProjectIssueStatusReportProps = {
  filters: ReportsFilterValue;
};

export default function CrossProjectIssueStatusReport({ filters }: CrossProjectIssueStatusReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const chartData = scopedProjects.map((project) => ({
    name: project.name,
    backlog: project.issueStatuses.backlog,
    inProgress: project.issueStatuses.inProgress,
    blocked: project.issueStatuses.blocked,
    done: project.issueStatuses.done,
  }));

  const totals = chartData.reduce(
    (acc, row) => {
      acc.backlog += row.backlog;
      acc.inProgress += row.inProgress;
      acc.blocked += row.blocked;
      acc.done += row.done;
      return acc;
    },
    { backlog: 0, inProgress: 0, blocked: 0, done: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Backlog</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totals.backlog}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Planned items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">In progress</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totals.inProgress}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Actively being worked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Blocked</p>
            <p className="text-3xl font-semibold text-rose-600 dark:text-rose-400">{totals.blocked}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Cross-project impediments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Done</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totals.done}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Completed regardless of sprint</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Issue status distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cross-project status mix without assuming synchronized sprints or workflows.
              </p>
            </div>
            <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
              Portfolio load
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#475569" interval={0} angle={-12} textAnchor="end" height={80} />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Legend />
                <Bar dataKey="backlog" stackId="issues" fill="#cbd5e1" name="Backlog" radius={[6, 6, 0, 0]} />
                <Bar dataKey="inProgress" stackId="issues" fill="#38bdf8" name="In progress" radius={[6, 6, 0, 0]} />
                <Bar dataKey="blocked" stackId="issues" fill="#f43f5e" name="Blocked" radius={[6, 6, 0, 0]} />
                <Bar dataKey="done" stackId="issues" fill="#22c55e" name="Done" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">Flow observation</p>
              <p className="mt-1">
                Blockers are concentrated in Orion; re-sequencing backlog and adding triage capacity could unblock nine issues without changing sprint plans.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">AI callout</p>
              <p className="mt-1">
                Consider a weekly governance review to keep backlog volume aligned with staffing, especially for Mobile where backlog is trending high.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
