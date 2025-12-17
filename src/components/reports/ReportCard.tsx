import Link from "next/link";
import type { ReactNode } from "react";

import { Card } from "../ui/Card";

export type ReportModule = {
  key: string;
  title: string;
  description: string;
  href: string;
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {scopeLabel[scope]}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">{module.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{module.description}</p>
        </div>
      </div>
      {footer && <div className="mt-4 text-sm text-slate-600 dark:text-slate-400">{footer}</div>}
    </Card>
  );

  if (ctaHref) {
    return (
      <Link
        href={ctaHref}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900"
      >
        {body}
      </Link>
    );
  }

  return body;
}

export const reportModules: ReportModule[] = [
  {
    key: "project-status-overview",
    title: "Project status overview",
    description: "Portfolio snapshot of health, lead time, and blockers across projects.",
    href: "/reports/project-status-overview",
  },
  {
    key: "delivery-health-summary",
    title: "Delivery health summary",
    description: "Aggregate throughput, predictability, and lead time trends.",
    href: "/reports/delivery-health-summary",
  },
  {
    key: "user-adoption",
    title: "User adoption",
    description: "Workspace engagement, update coverage, and response health.",
    href: "/reports/user-adoption",
  },
  {
    key: "role-distribution",
    title: "Role distribution",
    description: "Contributor mix across admins, product, engineering, and QA.",
    href: "/reports/role-distribution",
  },
  {
    key: "cross-project-issues",
    title: "Cross-project issue status",
    description: "Status distribution across projects without sprint coupling.",
    href: "/reports/cross-project-issues",
  },
  {
    key: "blocker-aggregation",
    title: "Blocker aggregation",
    description: "Themes and recurrence of blockers across the portfolio.",
    href: "/reports/blocker-aggregation",
  },
  {
    key: "aging-issues",
    title: "Aging issues",
    description: "Highlight stalled work regardless of workflow or cadence.",
    href: "/reports/aging-issues",
  },
  {
    key: "inactive-projects",
    title: "Inactive projects",
    description: "Spot projects without movement to close, pause, or re-staff.",
    href: "/reports/inactive-projects",
  },
  {
    key: "orphaned-work",
    title: "Orphaned work",
    description: "Detect unassigned or disconnected items across the workspace.",
    href: "/reports/orphaned-work",
  },
];
