"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";
import { portfolioProjects } from "./workspaceSampleData";

type RoleDistributionReportProps = {
  filters: ReportsFilterValue;
};

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b"];

export default function RoleDistributionReport({ filters }: RoleDistributionReportProps) {
  const scopedProjects = useMemo(() => {
    if (filters.projectId && filters.projectId !== "all") {
      const match = portfolioProjects.find((project) => project.id === filters.projectId);
      return match ? [match] : portfolioProjects;
    }

    return portfolioProjects;
  }, [filters.projectId]);

  const roleBreakdown = useMemo(() => {
    return scopedProjects.reduce(
      (acc, project) => {
        acc.admin += project.roles.admin;
        acc.po += project.roles.po;
        acc.dev += project.roles.dev;
        acc.qa += project.roles.qa;
        return acc;
      },
      { admin: 0, po: 0, dev: 0, qa: 0 }
    );
  }, [scopedProjects]);

  const pieData = [
    { name: "Admins", value: roleBreakdown.admin },
    { name: "Product", value: roleBreakdown.po },
    { name: "Developers", value: roleBreakdown.dev },
    { name: "QA", value: roleBreakdown.qa },
  ];

  const totalContributors = pieData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total contributors</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{totalContributors}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Across all projects in scope</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery capacity</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{roleBreakdown.dev + roleBreakdown.qa}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Engineers and QA combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Leadership ratio</p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              1:{Math.max(1, Math.round(totalContributors / Math.max(1, roleBreakdown.admin + roleBreakdown.po)))}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Admins + POs to contributors</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Role distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Aggregated contributor mix across projects; useful for staffing and governance discussions.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Governance
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{Math.round((item.value / Math.max(1, totalContributors)) * 100)}% of contributors</p>
                    </div>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{item.value}</span>
                </div>
              ))}

              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-50">AI allocation hint</p>
                <p className="mt-1">
                  Consider rotating a QA from Neptune into Apollo to rebalance delivery support without changing sprint plans.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
