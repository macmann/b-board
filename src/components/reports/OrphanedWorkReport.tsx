"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent } from "../ui/Card";
import type { ReportsFilterValue } from "./ReportsFilters";

import { Button } from "../ui/Button";

import { IssueStatus, IssueType } from "@/lib/prismaEnums";

type IssueSample = {
  id: string;
  key: string | null;
  title: string;
  status: IssueStatus;
  type: IssueType;
  projectName: string;
  updatedAt: string;
};

type StandupSample = {
  id: string;
  date: string;
  projectName: string;
  userName: string;
  summary: string | null;
};

type OrphanedWorkResponse = {
  counts: {
    unassigned: number;
    missingEpic: number;
    unsprintedActive: number;
    unlinkedStandups: number;
  };
  samples: {
    unassigned: IssueSample[];
    missingEpic: IssueSample[];
    unsprintedActive: IssueSample[];
    unlinkedStandups: StandupSample[];
  };
};

type OrphanedWorkReportProps = {
  filters: ReportsFilterValue;
};

const issueStatusLabels: Record<IssueStatus, string> = {
  [IssueStatus.TODO]: "To do",
  [IssueStatus.IN_PROGRESS]: "In progress",
  [IssueStatus.IN_REVIEW]: "In review",
  [IssueStatus.DONE]: "Done",
};

const issueTypeLabels: Record<IssueType, string> = {
  [IssueType.STORY]: "Story",
  [IssueType.BUG]: "Bug",
  [IssueType.TASK]: "Task",
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export default function OrphanedWorkReport({ filters }: OrphanedWorkReportProps) {
  const [data, setData] = useState<OrphanedWorkResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      from: filters.dateFrom,
      to: filters.dateTo,
      projectId: filters.projectId,
    });

    fetch(`/api/reports/orphaned-work?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load orphaned work");
        }
        return (await response.json()) as OrphanedWorkResponse;
      })
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(
          err instanceof Error
            ? err.message
            : "Unable to fetch orphaned work data"
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters.dateFrom, filters.dateTo, filters.projectId]);

  const totalOrphaned = useMemo(() => {
    if (!data) return 0;
    return (
      data.counts.unassigned +
      data.counts.missingEpic +
      data.counts.unsprintedActive +
      data.counts.unlinkedStandups
    );
  }, [data]);

  const sections = useMemo(
    () => [
      {
        key: "unassigned",
        title: "Unassigned issues",
        description: "Work with no owner assigned",
        count: data?.counts.unassigned ?? 0,
        items: data?.samples.unassigned ?? [],
      },
      {
        key: "missingEpic",
        title: "Stories without an epic",
        description: "Story items lacking parent alignment",
        count: data?.counts.missingEpic ?? 0,
        items: data?.samples.missingEpic ?? [],
      },
      {
        key: "unsprintedActive",
        title: "Active work outside sprints",
        description: "In-flight items not planned into a sprint",
        count: data?.counts.unsprintedActive ?? 0,
        items: data?.samples.unsprintedActive ?? [],
      },
      {
        key: "unlinkedStandups",
        title: "Unlinked standup updates",
        description: "Standup entries without linked issues or research",
        count: data?.counts.unlinkedStandups ?? 0,
        items: data?.samples.unlinkedStandups ?? [],
      },
    ],
    [data]
  );

  const hasResults = totalOrphaned > 0;

  const toggleSection = (key: string) => {
    setExpanded((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Total orphaned
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {loading && !data ? "–" : totalOrphaned}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Unowned or disconnected items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Unassigned
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {loading && !data ? "–" : data?.counts.unassigned ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Needs owner</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Missing epic
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {loading && !data ? "–" : data?.counts.missingEpic ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">No epic alignment</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Active without sprint
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {loading && !data ? "–" : data?.counts.unsprintedActive ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">In progress but unsprinted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Unlinked standups
            </p>
            <p className="text-3xl font-semibold text-slate-900 dark:text-slate-50">
              {loading && !data ? "–" : data?.counts.unlinkedStandups ?? "–"}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Updates without linked work
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </CardContent>
        </Card>
      )}

      {loading && !data && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 text-sm text-slate-600 dark:text-slate-300">
            Scanning for orphaned work…
          </CardContent>
        </Card>
      )}

      {data && !hasResults && !loading && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-10 text-center text-sm text-slate-600 dark:text-slate-300">
            Everything is linked and assigned for the selected filters.
          </CardContent>
        </Card>
      )}

      {data && hasResults && (
        <Card className="border border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Orphaned work breakdown
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Counts by category with sample items (top 20 per list).
                </p>
              </div>
              <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                Data hygiene
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-800 dark:border-slate-800">
              {sections.map((section) => (
                <div key={section.key} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {section.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {section.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {section.count}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSection(section.key)}
                        className="text-xs"
                      >
                        {expanded[section.key] ? "Hide" : "Show"} list
                      </Button>
                    </div>
                  </div>

                  {expanded[section.key] && (
                    <div className="mt-3 space-y-2">
                      {section.items.length === 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No examples in this category for the selected filters.
                        </p>
                      )}

                      {section.key === "unlinkedStandups"
                        ? (section.items as StandupSample[]).map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-slate-900 dark:text-slate-50">
                                  {entry.userName}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatDate(entry.date)}
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {entry.projectName}
                              </p>
                              {entry.summary && (
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                                  {entry.summary}
                                </p>
                              )}
                            </div>
                          ))
                        : (section.items as IssueSample[]).map((issue) => (
                            <div
                              key={issue.id}
                              className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-indigo-700 dark:text-indigo-300">
                                  {issue.key ?? issue.id.slice(0, 8)}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Updated {formatDate(issue.updatedAt)}
                                </div>
                              </div>
                              <p className="text-sm text-slate-900 dark:text-slate-50">{issue.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  {issueStatusLabels[issue.status]}
                                </span>
                                <span className="rounded-full bg-slate-50 px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                  {issueTypeLabels[issue.type]}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">{issue.projectName}</span>
                              </div>
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
