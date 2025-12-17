"use client";

import clsx from "clsx";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DEFAULT_REPORT_MODULE, parseReportSearchParams } from "@/lib/reports/filters";

export type ReportModuleNavItem = {
  key: string;
  title: string;
  description: string;
};

type ReportModuleNavProps = {
  activeModuleKey: string;
  modules: ReadonlyArray<ReportModuleNavItem>;
};

export default function ReportModuleNav({
  activeModuleKey,
  modules,
}: ReportModuleNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentModule = useMemo(() => {
    const parsed = parseReportSearchParams(searchParams);
    return parsed.module ?? activeModuleKey;
  }, [activeModuleKey, searchParams]);

  const handleSelect = (key: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (key === DEFAULT_REPORT_MODULE) {
      params.delete("module");
    } else {
      params.set("module", key);
    }

    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`);
  };

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Report modules
      </p>
      <div className="mt-4 space-y-2">
        {modules.map((module) => (
          <button
            key={module.key}
            type="button"
            onClick={() => handleSelect(module.key)}
            className={clsx(
              "block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition",
              currentModule === module.key
                ? "bg-primary/10 text-primary"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{module.title}</span>
              {currentModule === module.key && (
                <span className="text-xs font-semibold uppercase text-primary">Active</span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-normal text-slate-500 dark:text-slate-400">
              {module.description}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
