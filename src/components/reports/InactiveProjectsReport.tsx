"use client";

import { useMemo } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { portfolioProjects } from "./workspaceSampleData";

type InactiveProjectsReportProps = {
  filters: ReportsFilterValue;
};

export default function InactiveProjectsReport({ filters }: InactiveProjectsReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const inactiveProjects = scopedProjects.filter((project) => project.lastActivityDays >= 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Inactive</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{inactiveProjects.length}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Projects without recent movement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Median lull</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {inactiveProjects.length
                ? `${Math.round(
                    inactiveProjects.reduce((sum, project) => sum + project.lastActivityDays, 0) / inactiveProjects.length
                  )}d`
                : "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Days since last update</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Action</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Review</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Schedule governance check-in</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Inactive projects</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Highlights projects without movement so leaders can decide to close, pause, or re-staff.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Governance alert
            </div>
          </div>

          {inactiveProjects.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">All projects have recent activity.</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {inactiveProjects.map((project) => (
                <div key={project.id} className="flex items-center justify-between px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{project.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{project.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold">{project.lastActivityDays}d</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">since last activity</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-50">AI prompt</p>
            <p className="mt-1">
              Run a portfolio review to confirm whether Orion Ops should be paused or rebooted with a smaller, outcome-focused backlog.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
