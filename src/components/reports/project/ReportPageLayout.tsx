import type { ReactNode } from "react";

import ReportFilterBar from "./ReportFilterBar";
import ReportModuleNav, { ReportModuleNavItem } from "./ReportModuleNav";
import type { ReportFilters } from "@/lib/reports/filters";

type ReportPageLayoutProps = {
  projectId: string;
  modules: ReadonlyArray<ReportModuleNavItem>;
  activeModule: ReportModuleNavItem;
  sprints: { id: string; name: string }[];
  filters: ReportFilters;
  showSprintSelect?: boolean;
  children: ReactNode;
};

export default function ReportPageLayout({
  projectId,
  modules,
  activeModule,
  sprints,
  filters,
  showSprintSelect = true,
  children,
}: ReportPageLayoutProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
      <ReportModuleNav activeModuleKey={activeModule.key} modules={modules} />

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Active module
              </p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                {activeModule.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {activeModule.description}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary">
              {activeModule.key}
            </span>
          </div>
        </div>

        <ReportFilterBar
          projectId={projectId}
          sprints={sprints}
          initialFilters={filters}
          showSprintSelect={showSprintSelect}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
      </div>
    </div>
  );
}
