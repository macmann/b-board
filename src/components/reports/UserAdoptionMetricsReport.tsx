"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { adoptionTrend, portfolioProjects } from "./workspaceSampleData";

type UserAdoptionMetricsReportProps = {
  filters: ReportsFilterValue;
};

export default function UserAdoptionMetricsReport({ filters }: UserAdoptionMetricsReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const adoptionSummary = useMemo(() => {
    return scopedProjects.reduce(
      (acc, project) => {
        acc.weeklyActive += project.adoption.weeklyActive;
        acc.monthlyActive += project.adoption.monthlyActive;
        acc.updateRate += project.adoption.updateRate;
        acc.firstResponseRate += project.adoption.firstResponseRate;
        return acc;
      },
      { weeklyActive: 0, monthlyActive: 0, updateRate: 0, firstResponseRate: 0 }
    );
  }, [scopedProjects]);

  const averageUpdateRate = Math.round((adoptionSummary.updateRate / scopedProjects.length) * 100);
  const averageFirstResponse = Math.round((adoptionSummary.firstResponseRate / scopedProjects.length) * 100);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Weekly active</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{adoptionSummary.weeklyActive}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Contributors in the last 7 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Monthly active</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{adoptionSummary.monthlyActive}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Workspace reach</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Update rate</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{averageUpdateRate}%</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Users with at least one update</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              First-response coverage
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{averageFirstResponse}%</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Updates acknowledged within 24h</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">User adoption trend</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Signals across all projects: weekly active contributors and update throughput, independent of team rituals.
              </p>
            </div>
            <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
              Adoption KPI
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={adoptionTrend} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#475569" />
                <YAxis allowDecimals={false} stroke="#475569" />
                <Tooltip />
                <Bar dataKey="activeUsers" fill="#6366f1" name="Active users" radius={[6, 6, 0, 0]} />
                <Bar dataKey="updates" fill="#14b8a6" name="Updates shared" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">Engagement insight</p>
              <p className="mt-1">
                Steady weekly engagement paired with rising update volume suggests broader adoption of issue updates versus status emails.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">AI nudge</p>
              <p className="mt-1">
                Target dormant contributors in Orion with a "what changed" digest to lift first-response coverage and reduce aging work.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
