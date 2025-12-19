import type { ReactNode } from "react";

import EmptyReportState from "../EmptyReportState";

const badgeClassName =
  "inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300";

type ReportModulePlaceholderProps = {
  title: string;
  description: string;
  helper?: ReactNode;
  actions?: ReactNode;
};

export default function ReportModulePlaceholder({
  title,
  description,
  helper,
  actions,
}: ReportModulePlaceholderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className={badgeClassName}>Preview</p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
        {actions}
      </div>
      <EmptyReportState
        title="Reporting visuals are not available yet"
        description="Preview data will appear here once the module is fully configured."
        className="flex min-h-[220px] flex-col justify-center"
      />
      {helper}
    </div>
  );
}
