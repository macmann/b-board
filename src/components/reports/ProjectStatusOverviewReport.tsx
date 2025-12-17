"use client";

import { useMemo } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { portfolioProjects, type PortfolioProject } from "./workspaceSampleData";

const formatStatusLabel = (status: PortfolioProject["status"]) => {
  if (status === "on-track") return "On track";
  if (status === "at-risk") return "At risk";
  return "Off track";
};

const statusColor = {
  "on-track": "text-emerald-600",
  "at-risk": "text-amber-600",
  "off-track": "text-rose-600",
};

type ProjectStatusOverviewReportProps = {
  filters: ReportsFilterValue;
};

export default function ProjectStatusOverviewReport({
  filters,
}: ProjectStatusOverviewReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const statusSummary = useMemo(() => {
    return scopedProjects.reduce(
      (acc, project) => {
        acc[project.status] += 1;
        acc.healthScore += project.healthScore;
        return acc;
      },
      { "on-track": 0, "at-risk": 0, "off-track": 0, healthScore: 0 }
    );
  }, [scopedProjects]);

  const avgHealthScore = Math.round(statusSummary.healthScore / scopedProjects.length);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              On track
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {statusSummary["on-track"]}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Projects meeting plan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">At risk</p>
            <p className="text-3xl font-semibold text-amber-600 dark:text-amber-400">
              {statusSummary["at-risk"]}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Needs intervention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Off track</p>
            <p className="text-3xl font-semibold text-rose-600 dark:text-rose-400">
              {statusSummary["off-track"]}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Escalations required</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Avg. health score
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{avgHealthScore}</p>
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
              {scopedProjects.map((project) => (
                <div
                  key={project.id}
                  className="grid grid-cols-6 items-center px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
                >
                  <div className="col-span-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-50">{project.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{project.category}</p>
                  </div>
                  <div className={`font-semibold ${statusColor[project.status]}`}>
                    {formatStatusLabel(project.status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{project.healthScore}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold">{project.leadTimeDays.toFixed(1)}d</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">median to done</p>
                  </div>
                  <div>
                    <p className="font-semibold">{project.blockers.reduce((sum, blocker) => sum + blocker.count, 0)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">active themes</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-slate-50">AI portfolio observation</p>
            <p className="mt-1">
              Delivery risk clusters around dependencies and external APIs. Rebalancing QA capacity on Apollo and closing
              orchestration gaps on Orion would improve the overall health score by ~8 points without slowing Neptune.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
