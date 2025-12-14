"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import ReportsFilters, { ReportsFilterValue } from "./ReportsFilters";
import { Card, CardContent, CardHeader } from "../ui/Card";

type ReportPageLayoutProps = {
  title: string;
  description: string;
  showSprintSelect?: boolean;
  placeholderLabel: string;
  placeholderDetail: string;
  renderContent?: (filters: ReportsFilterValue) => ReactNode;
};

const ALL_PROJECTS_VALUE = "all";

const getDefaultDates = () => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);
  return { from, to };
};

const parseFiltersFromSearch = (
  searchParams: ReturnType<typeof useSearchParams> | null | undefined,
  showSprintSelect: boolean
): ReportsFilterValue => {
  const defaults = getDefaultDates();
  const params = new URLSearchParams(searchParams?.toString() ?? "");

  return {
    dateFrom: params.get("from") ?? defaults.from,
    dateTo: params.get("to") ?? defaults.to,
    projectId: params.get("projectId") ?? ALL_PROJECTS_VALUE,
    sprintId: showSprintSelect ? params.get("sprintId") : null,
  };
};

const areFiltersEqual = (a: ReportsFilterValue, b: ReportsFilterValue) =>
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  a.projectId === b.projectId &&
  (a.sprintId ?? null) === (b.sprintId ?? null);

export default function ReportPageLayout({
  title,
  description,
  showSprintSelect = false,
  placeholderLabel,
  placeholderDetail,
  renderContent,
}: ReportPageLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<ReportsFilterValue>(() =>
    parseFiltersFromSearch(searchParams, showSprintSelect)
  );

  const queryStringFromFilters = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", filters.dateFrom);
    params.set("to", filters.dateTo);
    params.set("projectId", filters.projectId);

    if (showSprintSelect && filters.sprintId) {
      params.set("sprintId", filters.sprintId);
    }

    return params.toString();
  }, [filters.dateFrom, filters.dateTo, filters.projectId, filters.sprintId, showSprintSelect]);

  useEffect(() => {
    const nextFilters = parseFiltersFromSearch(searchParams, showSprintSelect);
    setFilters((current) =>
      areFiltersEqual(current, nextFilters) ? current : nextFilters
    );
  }, [searchParams, showSprintSelect]);

  useEffect(() => {
    const search = queryStringFromFilters ? `?${queryStringFromFilters}` : "";
    router.replace(`${pathname}${search}`);
  }, [pathname, queryStringFromFilters, router]);

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </header>

      <Card className="rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Filters</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Narrow the timeframe and scope before running the report.
            </p>
          </div>
          <ReportsFilters
            value={filters}
            onChange={setFilters}
            showSprintSelect={showSprintSelect}
          />
        </CardHeader>
        <CardContent>
          {renderContent ? (
            renderContent(filters)
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                {placeholderLabel}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{placeholderDetail}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
