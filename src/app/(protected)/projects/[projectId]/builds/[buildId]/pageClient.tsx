"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import IssueTypeIcon, { ISSUE_TYPE_METADATA } from "@/components/issues/IssueTypeIcon";
import {
  BuildEnvironment,
  BuildStatus,
  IssueType,
  IssueStatus,
} from "@/lib/prismaEnums";
import { PROJECT_CONTRIBUTOR_ROLES, type ProjectRole } from "@/lib/roles";
import { routes } from "@/lib/routes";

type BuildInfo = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: BuildStatus;
  environment: BuildEnvironment;
  plannedAt: string | null;
  deployedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type IssueInfo = {
  id: string;
  key: string | null;
  title: string;
  type: IssueType;
  status: IssueStatus;
  sprintName: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  createdAt: string;
};

type Props = {
  projectId: string;
  buildId: string;
  projectRole: ProjectRole | null;
  build: BuildInfo;
  linkedIssues: IssueInfo[];
};

const buildStatusLabels: Record<BuildStatus, string> = {
  [BuildStatus.PLANNED]: "Planned",
  [BuildStatus.IN_PROGRESS]: "In progress",
  [BuildStatus.DEPLOYED]: "Deployed",
  [BuildStatus.ROLLED_BACK]: "Rolled back",
  [BuildStatus.CANCELLED]: "Cancelled",
};

const environmentLabels: Record<BuildEnvironment, string> = {
  [BuildEnvironment.DEV]: "Dev",
  [BuildEnvironment.STAGING]: "Staging",
  [BuildEnvironment.UAT]: "UAT",
  [BuildEnvironment.PROD]: "Prod",
};

const issueStatusLabels: Record<IssueStatus, string> = {
  [IssueStatus.TODO]: "To do",
  [IssueStatus.IN_PROGRESS]: "In progress",
  [IssueStatus.IN_REVIEW]: "In review",
  [IssueStatus.DONE]: "Done",
};

const issueTypeOrder: IssueType[] = [IssueType.STORY, IssueType.BUG, IssueType.TASK];

const buildBadgeVariants: Partial<Record<BuildStatus, "success" | "info" | "neutral" | "warning">> = {
  [BuildStatus.DEPLOYED]: "success",
  [BuildStatus.IN_PROGRESS]: "info",
  [BuildStatus.ROLLED_BACK]: "warning",
};

const formatDate = (value: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatLeadTime = (start: Date | null, end: Date | null) => {
  if (!start || !end) return "Not available";

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0 || Number.isNaN(diffMs)) return "Not available";

  const totalHours = Math.round(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) {
    return `${hours}h`;
  }

  if (hours === 0) {
    return `${days}d`;
  }

  return `${days}d ${hours}h`;
};

export default function BuildDetailsPageClient({
  projectId,
  buildId,
  projectRole,
  build,
  linkedIssues,
}: Props) {
  const canEditIssues = useMemo(
    () => (projectRole ? PROJECT_CONTRIBUTOR_ROLES.includes(projectRole) : false),
    [projectRole]
  );

  const [issues, setIssues] = useState<IssueInfo[]>(linkedIssues);
  const [actionMessage, setActionMessage] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<IssueInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");

  const linkedIssueIds = useMemo(() => new Set(issues.map((issue) => issue.id)), [issues]);

  const issueTypeCounts = useMemo(() => {
    const counts: Record<IssueType, number> = {
      [IssueType.STORY]: 0,
      [IssueType.BUG]: 0,
      [IssueType.TASK]: 0,
    };

    issues.forEach((issue) => {
      counts[issue.type] = (counts[issue.type] ?? 0) + 1;
    });

    return counts;
  }, [issues]);

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<IssueStatus, number>> = {};
    issues.forEach((issue) => {
      counts[issue.status] = (counts[issue.status] ?? 0) + 1;
    });
    return counts;
  }, [issues]);

  const earliestIssueStart = useMemo(() => {
    let earliest: Date | null = null;
    issues.forEach((issue) => {
      const date = new Date(issue.createdAt);
      if (Number.isNaN(date.getTime())) return;
      if (!earliest || date < earliest) {
        earliest = date;
      }
    });
    return earliest;
  }, [issues]);

  const leadTimeDisplay = useMemo(() => {
    const deployedDate = build.deployedAt ? new Date(build.deployedAt) : null;
    const isValidDeployed = deployedDate && !Number.isNaN(deployedDate.getTime());
    return formatLeadTime(earliestIssueStart, isValidDeployed ? deployedDate : null);
  }, [build.deployedAt, earliestIssueStart]);

  const mapIssue = useCallback(
    (issue: any): IssueInfo => ({
      id: issue.id,
      key: issue.key ?? null,
      title: issue.title ?? "Untitled issue",
      type: (issue.type as IssueType) ?? IssueType.STORY,
      status: issue.status as IssueStatus,
      sprintName: issue.sprint?.name ?? null,
      assigneeName: issue.assignee?.name ?? null,
      assigneeId: issue.assignee?.id ?? null,
      createdAt: issue.createdAt ?? new Date().toISOString(),
    }),
    []
  );

  const performSearch = useCallback(
    async (query: string) => {
      setIsSearching(true);
      setActionMessage("");

      try {
        const params = new URLSearchParams();
        params.set("take", "8");
        if (query.trim()) {
          params.set("query", query.trim());
        }

        const response = await fetch(
          `/api/projects/${projectId}/standup/search-issues?${params.toString()}`
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setActionMessage(body?.message ?? "Unable to search issues");
          return;
        }

        const data = (await response.json()) as any[];
        const mapped = data.map(mapIssue).filter((issue) => !linkedIssueIds.has(issue.id));
        setSearchResults(mapped);
      } catch (error) {
        setActionMessage("Unable to search issues");
      } finally {
        setIsSearching(false);
      }
    },
    [projectId, mapIssue, linkedIssueIds]
  );

  useEffect(() => {
    if (!canEditIssues) return undefined;

    const handler = window.setTimeout(() => {
      void performSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(handler);
  }, [canEditIssues, performSearch, search]);

  const handleLinkIssue = async (issue: IssueInfo) => {
    if (!canEditIssues) return;
    setLinkingId(issue.id);
    setActionMessage("");

    try {
      const response = await fetch(`/api/builds/${buildId}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds: [issue.id] }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setActionMessage(body?.message ?? "Unable to link issue");
        return;
      }

      setIssues((prev) => (prev.some((item) => item.id === issue.id) ? prev : [...prev, issue]));
      setSearchResults((prev) => prev.filter((item) => item.id !== issue.id));
    } catch (error) {
      setActionMessage("Unable to link issue");
    } finally {
      setLinkingId(null);
    }
  };

  const handleUnlinkIssue = async (issueId: string) => {
    if (!canEditIssues) return;
    setRemovingId(issueId);
    setActionMessage("");

    try {
      const response = await fetch(`/api/builds/${buildId}/issues`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueIds: [issueId] }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setActionMessage(body?.message ?? "Unable to remove issue");
        return;
      }

      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
    } catch (error) {
      setActionMessage("Unable to remove issue");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          <Link href={routes.project.builds(projectId)} className="text-primary hover:underline">
            Back to builds
          </Link>
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-400">
          <div>
            Updated {formatDate(build.updatedAt)}
          </div>
          <div className="hidden sm:block">•</div>
          <div>Created {formatDate(build.createdAt)}</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                  {build.key}
                </h1>
                <Badge variant={buildBadgeVariants[build.status] ?? "neutral"}>
                  {buildStatusLabels[build.status]}
                </Badge>
                <Badge variant="outline">{environmentLabels[build.environment]}</Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {build.name || "No display name provided."}
              </p>
            </div>
            {build.description && (
              <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                {build.description}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
              <div className="text-xs uppercase tracking-wide text-slate-500">Status</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {buildStatusLabels[build.status]}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
              <div className="text-xs uppercase tracking-wide text-slate-500">Environment</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {environmentLabels[build.environment]}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
              <div className="text-xs uppercase tracking-wide text-slate-500">Planned</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {formatDate(build.plannedAt)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/40">
              <div className="text-xs uppercase tracking-wide text-slate-500">Deployed</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {formatDate(build.deployedAt)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {actionMessage && (
        <Card>
          <CardContent className="py-3 text-sm text-rose-600 dark:text-rose-400">
            {actionMessage}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                  Linked issues
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Track work deployed with this build.
                </p>
              </div>
              {canEditIssues && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search issues by key or title"
                    className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => void performSearch(search.trim())}
                    disabled={isSearching}
                  >
                    {isSearching ? "Searching..." : "Refresh"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {canEditIssues && searchResults.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Search results
                </div>
                <div className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  {searchResults.map((issue) => (
                    <div
                      key={issue.id}
                      className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {issue.key ?? issue.title}
                          </span>
                          <Badge variant="outline">{issueStatusLabels[issue.status]}</Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {issue.title}
                        </p>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {issue.sprintName ?? "No sprint"} • {issue.assigneeName ?? "Unassigned"}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          onClick={() => handleLinkIssue(issue)}
                          disabled={linkingId === issue.id}
                        >
                          {linkingId === issue.id ? "Adding..." : "Add"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-5 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
                <div className="col-span-2">Issue</div>
                <div>Status</div>
                <div>Sprint</div>
                <div className="text-right">Assignee</div>
              </div>
              {issues.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-600 dark:text-slate-400">
                  No issues linked yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  {issues.map((issue) => (
                    <div
                      key={issue.id}
                      className="grid grid-cols-5 items-center gap-2 px-4 py-3"
                    >
                      <div className="col-span-2">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {issue.key ?? issue.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {issue.title}
                        </div>
                      </div>
                      <div>
                        <Badge variant="outline">{issueStatusLabels[issue.status]}</Badge>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-300">
                        {issue.sprintName ?? "—"}
                      </div>
                      <div className="flex items-center justify-end gap-3 text-sm text-slate-700 dark:text-slate-300">
                        <span>{issue.assigneeName ?? "Unassigned"}</span>
                        {canEditIssues && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleUnlinkIssue(issue.id)}
                            disabled={removingId === issue.id}
                          >
                            {removingId === issue.id ? "Removing..." : "Remove"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Build report</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Snapshot of issues included in this build.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
                <div className="text-xs uppercase tracking-wide text-slate-500">Lead time</div>
                <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">{leadTimeDisplay}</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Earliest linked issue start to deployed time.
                </p>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By issue type</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {issueTypeOrder.map((type) => (
                    <div
                      key={type}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <IssueTypeIcon type={type} />
                        <span>{ISSUE_TYPE_METADATA[type].label}</span>
                      </div>
                      <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                        {issueTypeCounts[type] ?? 0}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">By status</div>
                <div className="space-y-2 text-sm">
                  {(Object.values(IssueStatus) as IssueStatus[]).map((status) => (
                    <div
                      key={status}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <span className="text-slate-700 dark:text-slate-200">{issueStatusLabels[status]}</span>
                      <Badge variant="outline">{statusCounts[status] ?? 0}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Included issues</div>
                {issues.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">No issues linked yet.</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    {issues.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                            <IssueTypeIcon type={issue.type} />
                            <span>{issue.key ?? issue.title}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{issue.title}</div>
                        </div>
                        <Badge variant="outline">{issueStatusLabels[issue.status]}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Release notes (draft)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Capture highlights for this deployment. Draft is local to this page.
              </p>
            </CardHeader>
            <CardContent>
              <textarea
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                rows={8}
                placeholder="Summarize changes, fixes, and known issues..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Notes are not yet saved; syncing to a release log can be added later.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
