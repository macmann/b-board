"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { agingBuckets, portfolioProjects } from "./workspaceSampleData";

type AgingIssuesReportProps = {
  filters: ReportsFilterValue;
};

export default function AgingIssuesReport({ filters }: AgingIssuesReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const agingIssues = useMemo(() => {
    return scopedProjects
      .flatMap((project) => project.agingIssues.map((issue) => ({ ...issue, project: project.name })))
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [scopedProjects]);

  const totalAging = agingIssues.reduce((sum, issue) => sum + (issue.ageDays > 14 ? 1 : 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Aging work</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totalAging}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Older than two weeks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Oldest item</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{agingIssues[0]?.ageDays ?? "–"}d</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Time since start</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner coverage</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{agingIssues.length}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Tracked with accountable owners</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Aging distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Cross-project view of items aging regardless of sprint length; helpful for governance reviews.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Delivery risk
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingBuckets} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#475569" />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">Top aging items</p>
              <div className="mt-2 space-y-2">
                {agingIssues.slice(0, 4).map((issue) => (
                  <div key={issue.key} className="rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-50">
                      <span className="font-mono text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{issue.key}</span>
                      <span>{issue.ageDays}d</span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{issue.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{issue.project} · {issue.owner}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">AI recommendation</p>
              <p className="mt-1">
                Timebox a dedicated clearance block for billing cleanup (ORI-44) and payment reconciliation (APL-88); both are older than a month and blocking downstream delivery.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
