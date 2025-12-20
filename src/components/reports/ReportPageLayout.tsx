"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import AgingIssuesReport from "./AgingIssuesReport";
import BlockerAggregationReport from "./BlockerAggregationReport";
import CrossProjectIssueStatusReport from "./CrossProjectIssueStatusReport";
import DeliveryHealthSummaryReport from "./DeliveryHealthSummaryReport";
import EmptyReportState from "./EmptyReportState";
import InactiveProjectsReport from "./InactiveProjectsReport";
import OrphanedWorkReport from "./OrphanedWorkReport";
import QASprint360Report from "./QASprint360Report";
import ProjectStatusOverviewReport from "./ProjectStatusOverviewReport";
import RoleDistributionReport from "./RoleDistributionReport";
import UserAdoptionMetricsReport from "./UserAdoptionMetricsReport";
import ReportsFilters, { ReportsFilterValue } from "./ReportsFilters";
import { Card, CardContent, CardHeader } from "../ui/Card";

export type ReportPageKey =
  | "projectStatusOverview"
  | "userAdoption"
  | "roleDistribution"
  | "blockerAggregation"
  | "inactiveProjects"
  | "agingIssues"
  | "orphanedWork"
  | "crossProjectStatus"
  | "deliveryHealth"
  | "qaSprint360";

type ReportPageLayoutProps = {
  title: string;
  description: string;
  showSprintSelect?: boolean;
  placeholderLabel: string;
  placeholderDetail: string;
  reportKey: ReportPageKey;
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
  reportKey,
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

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const values = {
      title,
      description,
      placeholderLabel,
      placeholderDetail,
    };

    const hasFunctionProp = Object.values(values).some(
      (value) => typeof value === "function"
    );

    if (hasFunctionProp) {
      console.warn(
        "[ReportPageLayout] Function props detected. Ensure only serializable props are passed from the server."
      );
    }
  }, [description, placeholderDetail, placeholderLabel, title]);

  const renderContent = () => {
    switch (reportKey) {
      case "projectStatusOverview":
        return <ProjectStatusOverviewReport filters={filters} />;
      case "userAdoption":
        return <UserAdoptionMetricsReport filters={filters} />;
      case "roleDistribution":
        return <RoleDistributionReport filters={filters} />;
      case "blockerAggregation":
        return <BlockerAggregationReport filters={filters} />;
      case "inactiveProjects":
        return <InactiveProjectsReport filters={filters} />;
      case "agingIssues":
        return <AgingIssuesReport filters={filters} />;
      case "orphanedWork":
        return <OrphanedWorkReport filters={filters} />;
      case "crossProjectStatus":
        return <CrossProjectIssueStatusReport filters={filters} />;
      case "deliveryHealth":
        return <DeliveryHealthSummaryReport filters={filters} />;
      case "qaSprint360":
        return <QASprint360Report filters={filters} />;
      default:
        return null;
    }
  };

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
          {renderContent() ?? (
            <EmptyReportState
              title={placeholderLabel}
              description={placeholderDetail}
              className="flex h-80 flex-col justify-center text-center"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
