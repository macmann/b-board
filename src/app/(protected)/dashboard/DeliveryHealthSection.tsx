"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

type SprintHealthRow = {
  id: string;
  name: string;
  projectName: string;
  totalIssues: number;
  doneIssues: number;
  scopeChanges: number;
  burndown: { date: string; remainingPoints: number }[];
};

type Props = {
  sprints: SprintHealthRow[];
};

const EmptyBurndown = ({ message }: { message: string }) => (
  <div className="flex h-[140px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
    {message}
  </div>
);

const BurndownTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as { date: string; remainingPoints: number } | undefined;

  if (!point) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="font-semibold text-slate-900 dark:text-slate-50">{point.date}</p>
      <p className="mt-1 text-slate-600 dark:text-slate-300">Remaining: {point.remainingPoints}</p>
    </div>
  );
};

const DeliveryHealthSection = ({ sprints }: Props) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Delivery Health
          </p>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Active sprint readiness</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Read-only overview for POs and Scrum Masters across current sprints.
          </p>
        </div>
        <span className="mt-2 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {sprints.length} sprint{sprints.length === 1 ? "" : "s"} tracked
        </span>
      </div>

      {sprints.length === 0 ? (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          No active sprints to monitor right now.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {sprints.map((sprint) => (
            <div
              key={sprint.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {sprint.projectName}
                </p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{sprint.name}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {sprint.doneIssues}/{sprint.totalIssues} issues done
                </p>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Scope changes
                  </span>
                  <span className="text-base font-semibold">{sprint.scopeChanges}</span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-[11px] font-semibold",
                    sprint.scopeChanges > 0
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100"
                  )}
                >
                  {sprint.scopeChanges > 0 ? "Added after start" : "Stable scope"}
                </span>
              </div>

              {sprint.burndown.length === 0 ? (
                <EmptyBurndown message="Burndown unavailable (missing dates)" />
              ) : (
                <div className="h-[140px] rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Burndown
                  </p>
                  <div className="mt-2 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sprint.burndown} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={[0, "dataMax"]} />
                        <Tooltip content={<BurndownTooltip />} />
                        <Line
                          type="monotone"
                          dataKey="remainingPoints"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryHealthSection;
