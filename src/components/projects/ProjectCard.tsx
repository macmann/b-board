"use client";

import clsx from "clsx";

export type ProjectCardProps = {
  id: string;
  keyCode: string;
  name: string;
  description?: string | null;
  isCurrentUserMember?: boolean;
  onClick?: () => void;
};

export default function ProjectCard({
  keyCode,
  name,
  description,
  onClick,
}: ProjectCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-primary/70 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 cursor-pointer"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {keyCode}
        </p>
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {name}
        </h3>
        <p
          className={clsx(
            "text-sm text-slate-500 dark:text-slate-400 line-clamp-2",
            !description && "italic"
          )}
        >
          {description?.trim() || "No description yet."}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm font-medium text-primary/80">
        <span className="text-slate-700 group-hover:text-primary dark:text-slate-200">
          Open backlog
        </span>
        <span className="text-slate-400 transition group-hover:text-primary">→</span>
      </div>
    </div>
  );
}
