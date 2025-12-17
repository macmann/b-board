"use client";

import { useMemo } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { portfolioProjects } from "./workspaceSampleData";

type OrphanedWorkReportProps = {
  filters: ReportsFilterValue;
};

export default function OrphanedWorkReport({ filters }: OrphanedWorkReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const orphanedTotals = scopedProjects.reduce(
    (acc, project) => {
      acc.unassigned += project.orphaned.unassigned;
      acc.missingParent += project.orphaned.missingParent;
      acc.stalled += project.orphaned.stalled;
      return acc;
    },
    { unassigned: 0, missingParent: 0, stalled: 0 }
  );

  const totalOrphaned = orphanedTotals.unassigned + orphanedTotals.missingParent + orphanedTotals.stalled;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total orphaned</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totalOrphaned}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Unowned or disconnected items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Unassigned</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{orphanedTotals.unassigned}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Needs owner</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Missing parent</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{orphanedTotals.missingParent}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">No epic or goal alignment</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Orphaned work detection</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Portfolio scan for unassigned, stalled, or disconnected work across projects and workflows.
              </p>
            </div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
              Data hygiene
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
            {scopedProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-50">{project.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{project.category}</p>
                </div>
                <div className="flex items-center gap-6">
                  <Metric label="Unassigned" value={project.orphaned.unassigned} />
                  <Metric label="Missing parent" value={project.orphaned.missingParent} />
                  <Metric label="Stalled" value={project.orphaned.stalled} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-50">AI hygiene suggestion</p>
            <p className="mt-1">
              Auto-assign unowned work to area leads and prompt epic alignment before allowing new in-progress starts next week.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

type MetricProps = {
  label: string;
  value: number;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="text-right">
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
