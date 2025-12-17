"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { portfolioProjects } from "./workspaceSampleData";

type BlockerAggregationReportProps = {
  filters: ReportsFilterValue;
};

const BLOCKER_COLORS = ["#f43f5e", "#fb7185", "#f97316", "#f59e0b", "#94a3b8"];

export default function BlockerAggregationReport({ filters }: BlockerAggregationReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const aggregatedBlockers = useMemo(() => {
    const bucket = new Map<string, { count: number; lastSeen: string }>();

    scopedProjects.forEach((project) => {
      project.blockers.forEach((blocker) => {
        const existing = bucket.get(blocker.theme);
        if (existing) {
          bucket.set(blocker.theme, {
            count: existing.count + blocker.count,
            lastSeen: blocker.lastSeen > existing.lastSeen ? blocker.lastSeen : existing.lastSeen,
          });
        } else {
          bucket.set(blocker.theme, { count: blocker.count, lastSeen: blocker.lastSeen });
        }
      });
    });

    return Array.from(bucket.entries())
      .map(([theme, info]) => ({ theme, ...info }))
      .sort((a, b) => b.count - a.count);
  }, [scopedProjects]);

  const totalBlockers = aggregatedBlockers.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Themes</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{aggregatedBlockers.length}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Distinct blocker patterns</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Occurrences</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totalBlockers}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Across all projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Latest sighting</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {aggregatedBlockers[0]?.lastSeen ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Most recent blocker date</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Blocker aggregation</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Themes consolidated across projects so leaders can address systemic risks without sprint coupling.
              </p>
            </div>
            <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
              Risk heatmap
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="h-72 lg:col-span-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aggregatedBlockers}
                    dataKey="count"
                    nameKey="theme"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                  >
                    {aggregatedBlockers.map((entry, index) => (
                      <Cell key={entry.theme} fill={BLOCKER_COLORS[index % BLOCKER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-3">
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                {aggregatedBlockers.map((blocker, index) => (
                  <div key={blocker.theme} className="flex items-center justify-between px-4 py-3 text-sm text-slate-800 dark:text-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: BLOCKER_COLORS[index % BLOCKER_COLORS.length] }} />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50">{blocker.theme}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Last seen {blocker.lastSeen}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-semibold">{blocker.count}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">reports</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-50">AI unblocker</p>
                <p className="mt-1">
                  Consolidate API dependencies into a weekly integration window and add a QA pairing session to retire repeated environment failures.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
