import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "../ui/Card";

export type ReportModule = {
  key: string;
  title: string;
  description: string;
};

type ReportCardProps = {
  module: ReportModule;
  scope: "workspace" | "project";
  ctaHref?: string;
  footer?: ReactNode;
};

const scopeLabel = {
  workspace: "Workspace",
  project: "Project",
};

export default function ReportCard({ module, scope, ctaHref, footer }: ReportCardProps) {
  const body = (
    <Card className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {scopeLabel[scope]}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{module.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{module.description}</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          Coming soon
        </span>
      </div>
      {footer && <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">{footer}</div>}
    </Card>
  );

  if (ctaHref) {
    return (
      <Link href={ctaHref} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900">
        {body}
      </Link>
    );
  }

  return body;
}

export const reportModules: ReportModule[] = [
  {
    key: "sprint-burndown",
    title: "Sprint Burndown",
    description: "Track remaining scope against time to spot at-risk sprints early.",
  },
  {
    key: "velocity-trend",
    title: "Velocity trend",
    description: "See delivery momentum across recent sprints to forecast capacity.",
  },
  {
    key: "cycle-time",
    title: "Cycle time",
    description: "Measure how long issues take from start to finish to surface bottlenecks.",
  },
  {
    key: "standup-insights",
    title: "Standup insights",
    description: "Summarize daily standup updates to highlight risks and progress.",
  },
  {
    key: "blocker-themes",
    title: "Blocker themes",
    description: "Aggregate blockers to understand recurring impediments across the team.",
  },
];
