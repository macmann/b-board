import clsx from "clsx";
import { ReactNode } from "react";

type BadgeProps = {
  children: ReactNode;
  variant?: "neutral" | "success" | "info" | "outline";
  className?: string;
};

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral:
    "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700",
  success:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800",
  info:
    "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-800",
  outline:
    "border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-100",
};

export function Badge({ children, variant = "neutral", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
