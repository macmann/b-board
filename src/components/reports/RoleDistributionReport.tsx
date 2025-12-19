"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "../ui/Card";
import EmptyReportState from "./EmptyReportState";
import type { ReportsFilterValue } from "./ReportsFilters";

type RoleBreakdown = {
  role: string;
  count: number;
  percentage: number;
};

type RoleDistributionResponse = {
  totalMembers: number;
  projectCount: number;
  roles: RoleBreakdown[];
};

type RoleDistributionReportProps = {
  filters: ReportsFilterValue;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  PO: "Product Owner",
  DEV: "Developer",
  QA: "QA",
  VIEWER: "Viewer",
};

const ROLE_COLORS = [
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-100",
  "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-100",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100",
  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100",
  "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
];

const formatPercent = (value: number) => `${Math.round(value * 1000) / 10}%`;

export default function RoleDistributionReport({
  filters,
}: RoleDistributionReportProps) {
  const [data, setData] = useState<RoleDistributionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("projectId", filters.projectId);
    return params.toString();
  }, [filters.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/reports/role-distribution?${queryString}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message ?? "Unable to load role distribution report");
        }

        return response.json();
      })
      .then((payload: RoleDistributionResponse) => {
        setData(payload);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Unable to load report");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const totalMembers = data?.totalMembers ?? 0;
  const roles = useMemo(() => {
    if (!data?.roles) return [] as RoleBreakdown[];

    return [...data.roles].sort((a, b) => b.count - a.count);
  }, [data?.roles]);

  const dominantRole = roles[0];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total members
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{data ? totalMembers : "—"}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Across the current report scope</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Projects covered
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{data ? data.projectCount : "—"}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Distinct projects with members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Leading role
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {dominantRole ? ROLE_LABELS[dominantRole.role] ?? dominantRole.role : "—"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {dominantRole ? `${formatPercent(dominantRole.percentage)} of members` : "Highest share in scope"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardContent className="p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Role distribution</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Breakdown of project members by their assigned role. Percentages are relative to the scoped total.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Staffing mix
            </div>
          </div>

          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">Loading role data…</div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          )}

          {!isLoading && !error && totalMembers === 0 && (
            <EmptyReportState
              title="No members found"
              description="Invite teammates or add project memberships to see the role distribution for this scope."
            />
          )}

          {!isLoading && !error && totalMembers > 0 && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                  <span>Role</span>
                  <span className="text-right">Members</span>
                  <span className="text-right">Percent</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {roles.map((role, index) => (
                    <div
                      key={role.role}
                      className="grid grid-cols-[1.2fr_0.8fr_0.8fr] items-center px-4 py-3 text-sm text-slate-800 dark:text-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${ROLE_COLORS[index % ROLE_COLORS.length]}`}
                        >
                          {ROLE_LABELS[role.role] ?? role.role}
                        </span>
                        <div className="flex-1 text-xs text-slate-500 dark:text-slate-400">
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.max(4, role.percentage * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-semibold">{role.count}</div>
                      <div className="text-right text-sm text-slate-700 dark:text-slate-300">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-100">
                          {formatPercent(role.percentage)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-slate-50">Staffing note</p>
                <p className="mt-1">
                  Use this mix to discuss coverage with stakeholders and rebalance roles across projects without changing sprint commitments.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
