import type { ReportFilter } from "./types";

export type ReportModuleKey =
  | "sprint-burndown"
  | "velocity-trend"
  | "cycle-time"
  | "standup-insights"
  | "blocker-themes";

export type ReportFilters = {
  dateFrom: string;
  dateTo: string;
  sprintId: string | null;
};

export const DEFAULT_REPORT_MODULE: ReportModuleKey = "sprint-burndown";

const DEFAULT_RANGE_DAYS = 30;
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const normalizeDate = (value: string | null, fallback: Date) => {
  if (!value) return fallback;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const getDefaultDateRange = (projectId?: string | null): ReportFilter => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (DEFAULT_RANGE_DAYS - 1));

  return { from, to, projectId: projectId ?? null };
};

const REPORT_MODULE_KEYS: ReportModuleKey[] = [
  "sprint-burndown",
  "velocity-trend",
  "cycle-time",
  "standup-insights",
  "blocker-themes",
];

export const normalizeModule = (
  input: string | null | undefined
): ReportModuleKey => {
  const moduleKey = input ?? DEFAULT_REPORT_MODULE;

  return REPORT_MODULE_KEYS.includes(moduleKey as ReportModuleKey)
    ? (moduleKey as ReportModuleKey)
    : DEFAULT_REPORT_MODULE;
};

const normalizeSearchParams = (searchParams: unknown | null) => {
  if (!searchParams) return new URLSearchParams();

  if (searchParams instanceof URLSearchParams) {
    return new URLSearchParams(searchParams);
  }

  if (typeof searchParams === "string") {
    return new URLSearchParams(searchParams);
  }

  if (
    typeof searchParams === "object" &&
    searchParams !== null &&
    !Array.isArray(searchParams)
  ) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value) && typeof value[0] === "string") {
        params.set(key, value[0]);
      }
    }
    return params;
  }

  return new URLSearchParams(String(searchParams));
};

export const parseReportFilter = (
  searchParams: unknown | null,
  defaults?: Partial<ReportFilter>
): ReportFilter => {
  const params = normalizeSearchParams(searchParams);
  const baseDefaults = getDefaultDateRange(defaults?.projectId ?? null);

  const from = normalizeDate(
    params.get("from"),
    defaults?.from ?? baseDefaults.from
  );
  const to = normalizeDate(params.get("to"), defaults?.to ?? baseDefaults.to);
  const projectId = params.get("projectId") ?? defaults?.projectId ?? null;

  if (from.getTime() > to.getTime()) {
    return baseDefaults;
  }

  return { from, to, projectId };
};

export const getDefaultReportFilters = (): ReportFilters => {
  const defaults = getDefaultDateRange();

  return {
    dateFrom: formatDate(defaults.from),
    dateTo: formatDate(defaults.to),
    sprintId: null,
  };
};

export const formatReportDate = formatDate;

export const parseReportSearchParams = (
  searchParams: unknown | null
): { module: ReportModuleKey; filters: ReportFilters } => {
  const params = normalizeSearchParams(searchParams);
  const module = normalizeModule(params.get("module"));
  const { from, to } = parseReportFilter(params);
  const sprintIdValue = params.get("sprintId");

  return {
    module,
    filters: {
      dateFrom: formatDate(from),
      dateTo: formatDate(to),
      sprintId: sprintIdValue && sprintIdValue.trim() !== "" ? sprintIdValue : null,
    },
  };
};

export const areReportFiltersEqual = (a: ReportFilters, b: ReportFilters) =>
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  (a.sprintId ?? null) === (b.sprintId ?? null);
