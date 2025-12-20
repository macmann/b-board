"use client";

import { useEffect, useMemo, useState } from "react";

import EmptyReportState from "./EmptyReportState";
import type { ReportsFilterValue } from "./ReportsFilters";
import { Badge } from "../ui/Badge";
import { Card, CardContent, CardHeader } from "../ui/Card";

import { IssueStatus, TestResultStatus } from "@/lib/prismaEnums";

const STATUS_LABELS: Record<TestResultStatus, string> = {
  [TestResultStatus.PASS]: "Pass",
  [TestResultStatus.FAIL]: "Fail",
  [TestResultStatus.BLOCKED]: "Blocked",
  [TestResultStatus.NOT_RUN]: "Not run",
};

const STATUS_COLORS: Record<TestResultStatus, string> = {
  [TestResultStatus.PASS]: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  [TestResultStatus.FAIL]: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  [TestResultStatus.BLOCKED]: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
  [TestResultStatus.NOT_RUN]: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 0,
});

type QASprint360Summary = {
  projectId: string;
  projectName: string;
  projectKey: string | null;
  sprint: {
    id: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
  };
  storyCount: number;
  testCaseCount: number;
  executionBreakdown: Record<TestResultStatus, number>;
  qaCompletionRate: number;
  qaCompletionBasis: string;
  openBugs: Array<{
    id: string;
    key: string | null;
    title: string;
    status: IssueStatus;
  }>;
};

type ApiResponse = {
  ok: boolean;
  data: QASprint360Summary[];
  message?: string;
};

type QASprint360ReportProps = {
  filters: ReportsFilterValue;
};

const formatDate = (value: string | null) => {
  if (!value) return "No dates";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(value)
    );
  } catch (error) {
    return value;
  }
};

export default function QASprint360Report({ filters }: QASprint360ReportProps) {
  const [data, setData] = useState<QASprint360Summary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", filters.dateFrom);
    params.set("to", filters.dateTo);
    params.set("projectId", filters.projectId);
    return params.toString();
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/reports/qa-sprint-360?${queryString}`, { signal: controller.signal })
      .then(async (response) => {
        const payload: ApiResponse = await response.json();
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || "Unable to load QA Sprint 360 data");
        }
        return payload;
      })
      .then((payload) => {
        setData(payload.data);
      })
      .catch((fetchError) => {
        if (fetchError.name === "AbortError") return;
        setError(fetchError.message || "Unable to load report");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [queryString]);

  const showEmptyState = !isLoading && !error && data.length === 0;

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
          Loading QA Sprint 360 data…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      )}

      {showEmptyState && (
        <EmptyReportState
          title="No QA data for selected filters"
          description="Try expanding the date range or selecting a different project to find the latest sprint results."
        />
      )}

      {!isLoading && !error && data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((project) => {
            const totalExecuted =
              project.executionBreakdown[TestResultStatus.PASS] +
              project.executionBreakdown[TestResultStatus.FAIL] +
              project.executionBreakdown[TestResultStatus.BLOCKED];

            return (
              <Card key={project.projectId} className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="flex flex-col gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {project.projectKey ? `${project.projectKey} · ${project.projectName}` : project.projectName}
                      </p>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                        Sprint: {project.sprint.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(project.sprint.startDate)} – {formatDate(project.sprint.endDate)}
                      </p>
                    </div>
                    <Badge variant="success">
                      QA completion {percentFormatter.format(project.qaCompletionRate)}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{project.qaCompletionBasis}</p>
                </CardHeader>
                <CardContent className="space-y-4 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Stories in sprint
                      </p>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{project.storyCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Linked test cases
                      </p>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{project.testCaseCount}</p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Executed this sprint
                      </p>
                      <p className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{totalExecuted}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Execution results</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(Object.keys(STATUS_LABELS) as TestResultStatus[]).map((status) => (
                        <div
                          key={status}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {STATUS_LABELS[status]}
                          </span>
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
                            {project.executionBreakdown[status]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">Open bugs from failed tests</p>
                    {project.openBugs.length === 0 ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400">No open bugs linked to failed executions.</p>
                    ) : (
                      <div className="space-y-2">
                        {project.openBugs.map((bug) => (
                          <div
                            key={bug.id}
                            className="flex items-start justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm shadow-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50"
                          >
                            <div>
                              <p className="font-semibold">
                                {bug.key ? `${bug.key} · ${bug.title}` : bug.title}
                              </p>
                              <p className="text-xs text-amber-800 dark:text-amber-200">Status: {bug.status}</p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/60 dark:text-amber-100">
                              Bug
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
