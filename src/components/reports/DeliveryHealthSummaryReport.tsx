"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { deliveryTrend, portfolioProjects } from "./workspaceSampleData";

type DeliveryHealthSummaryReportProps = {
  filters: ReportsFilterValue;
};

export default function DeliveryHealthSummaryReport({
  filters,
}: DeliveryHealthSummaryReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const aggregates = useMemo(() => {
    const totals = scopedProjects.reduce(
      (acc, project) => {
        acc.throughput += project.throughputPerWeek;
        acc.leadTime += project.leadTimeDays;
        acc.predictability += project.predictability;
        return acc;
      },
      { throughput: 0, leadTime: 0, predictability: 0 }
    );

    const divisor = scopedProjects.length || 1;

    return {
      throughput: Math.round(totals.throughput / divisor),
      leadTime: (totals.leadTime / divisor).toFixed(1),
      predictability: Math.round((totals.predictability / divisor) * 100),
    };
  }, [scopedProjects]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Weekly throughput
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{aggregates.throughput}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Issues completed per week across portfolio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Median lead time
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{aggregates.leadTime}d</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Start to done across workflows</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Predictability
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{aggregates.predictability}%</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Commitment confidence (no sprint dependency)</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Delivery health trends</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Trending throughput and predictability over the last six weeks; aggregated across all projects regardless of cadence.
              </p>
            </div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
              Leadership ready
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={deliveryTrend}
                margin={{ top: 16, right: 16, left: 8, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="week" stroke="#475569" />
                <YAxis yAxisId="left" stroke="#475569" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#475569" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip formatter={(value: number, name) => (name === "predictability" ? [`${Math.round(value * 100)}%`, "Predictability"] : [value, "Throughput"])} />
                <Legend />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="throughput"
                  stroke="#6366f1"
                  fill="#6366f1"
                  name="Throughput"
                  fillOpacity={0.2}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="predictability"
                  stroke="#10b981"
                  fill="#10b981"
                  name="Predictability"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">Delivery signal</p>
              <p className="mt-1">
                Portfolio throughput is climbing while predictability remains above 80%, suggesting consistent planning without reliance on shared sprint schedules.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">Lead time note</p>
              <p className="mt-1">
                Lead time variance is driven by deployment approvals on operations work. Removing that bottleneck would shave ~1.2 days for Orion-class efforts.
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-50">AI recommendation</p>
              <p className="mt-1">
                Shift one backend squad from Neptune to Apollo for a week to stabilize API dependencies, then reassess throughput after the next release train.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
