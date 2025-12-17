"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  areReportFiltersEqual,
  getDefaultReportFilters,
  parseReportSearchParams,
  type ReportFilters,
} from "@/lib/reports/filters";

type SprintOption = {
  id: string;
  name: string;
};

type ReportFilterBarProps = {
  projectId: string;
  sprints: SprintOption[];
  initialFilters?: ReportFilters;
  showSprintSelect?: boolean;
};

const inputClassName =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50";

const labelClassName =
  "text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

export default function ReportFilterBar({
  projectId,
  sprints,
  initialFilters,
  showSprintSelect = true,
}: ReportFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ReportFilters>(
    initialFilters ?? getDefaultReportFilters()
  );

  const selectedSprintExists = useMemo(
    () => !filters.sprintId || sprints.some((sprint) => sprint.id === filters.sprintId),
    [filters.sprintId, sprints]
  );

  const updateUrl = (nextFilters: ReportFilters) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    params.set("from", nextFilters.dateFrom);
    params.set("to", nextFilters.dateTo);

    if (nextFilters.sprintId) {
      params.set("sprintId", nextFilters.sprintId);
    } else {
      params.delete("sprintId");
    }

    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`);
  };

  const handleChange = (partial: Partial<ReportFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...partial };
      updateUrl(next);
      return next;
    });
  };

  useEffect(() => {
    const parsed = parseReportSearchParams(searchParams);
    if (!areReportFiltersEqual(parsed.filters, filters)) {
      setFilters(parsed.filters);
    }
  }, [filters, searchParams]);

  useEffect(() => {
    if (!selectedSprintExists && sprints.length > 0) {
      handleChange({ sprintId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSprintExists, sprints.length]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Filters</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Adjust the date range and sprint scope for this report.
          </p>
        </div>
        <div className="grid w-full gap-4 md:grid-cols-2 lg:max-w-3xl lg:grid-cols-3">
          <div className="space-y-1.5">
            <label className={labelClassName} htmlFor="dateFrom">
              From
            </label>
            <input
              id="dateFrom"
              name="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(event) => handleChange({ dateFrom: event.target.value })}
              className={inputClassName}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClassName} htmlFor="dateTo">
              To
            </label>
            <input
              id="dateTo"
              name="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(event) => handleChange({ dateTo: event.target.value })}
              className={inputClassName}
            />
          </div>
          {showSprintSelect && (
            <div className="space-y-1.5">
              <label className={labelClassName} htmlFor="sprintId">
                Sprint
              </label>
              <select
                id="sprintId"
                name="sprintId"
                value={filters.sprintId ?? ""}
                onChange={(event) => handleChange({ sprintId: event.target.value || null })}
                className={clsx(inputClassName, "appearance-none")}
              >
                <option value="">All sprints</option>
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>
                    {sprint.name}
                  </option>
                ))}
              </select>
              {sprints.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No sprints yet. Head to the {" "}
                  <Link
                    className="text-primary underline"
                    href={`/projects/${projectId}/sprints`}
                  >
                    Sprints tab
                  </Link>{" "}
                  to create one.
                </p>
              ) : !selectedSprintExists ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This sprint is no longer available. Showing all sprints instead.
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose a sprint to narrow results or leave as All.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
