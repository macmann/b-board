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

const isIsoDate = (value: string) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && value.length === 10;
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

export const getDefaultReportFilters = (): ReportFilters => {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today);
  fromDate.setDate(fromDate.getDate() - 13);
  const dateFrom = fromDate.toISOString().slice(0, 10);

  return {
    dateFrom,
    dateTo: to,
    sprintId: null,
  };
};

const getDateValue = (
  params: URLSearchParams,
  key: "from" | "to",
  fallback: string
) => {
  const value = params.get(key);
  return value && isIsoDate(value) ? value : fallback;
};

export const parseReportSearchParams = (
  searchParams: unknown | null
): { module: ReportModuleKey; filters: ReportFilters } => {
  const params = normalizeSearchParams(searchParams);
  const defaults = getDefaultReportFilters();

  const module = normalizeModule(params.get("module"));
  const dateFrom = getDateValue(params, "from", defaults.dateFrom);
  const dateTo = getDateValue(params, "to", defaults.dateTo);
  const sprintIdValue = params.get("sprintId");

  return {
    module,
    filters: {
      dateFrom,
      dateTo,
      sprintId: sprintIdValue && sprintIdValue.trim() !== "" ? sprintIdValue : null,
    },
  };
};

export const areReportFiltersEqual = (a: ReportFilters, b: ReportFilters) =>
  a.dateFrom === b.dateFrom &&
  a.dateTo === b.dateTo &&
  (a.sprintId ?? null) === (b.sprintId ?? null);
