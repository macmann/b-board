import type { ReactNode } from "react";

type EmptyReportStateProps = {
  title: string;
  description?: string;
  className?: string;
  actions?: ReactNode;
};

export default function EmptyReportState({
  title,
  description,
  className,
  actions,
}: EmptyReportStateProps) {
  const classes = [
    "rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <p className="font-semibold text-slate-900 dark:text-slate-50">{title}</p>
      {description && (
        <p className="mt-1 text-slate-600 dark:text-slate-400">{description}</p>
      )}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
