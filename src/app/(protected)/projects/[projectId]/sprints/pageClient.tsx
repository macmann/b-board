"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CreateSprintDrawer from "@/components/sprints/CreateSprintDrawer";
import { Button } from "@/components/ui/Button";
import { routes } from "../../../../../lib/routes";

import {
  BuildEnvironment,
  BuildStatus,
  SprintStatus,
} from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";
import { canManageSprints } from "../../../../../lib/uiPermissions";

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
  storyPoints: number;
};

type SprintIncrementSummary = {
  sprintId: string;
  totalIssues: number;
  doneIssues: number;
  blockingIssues: number;
  potentiallyReleasable: boolean;
  builds: Array<{
    id: string;
    key: string;
    status: string;
    environment: string;
    deployedAt: string | null;
    issueCount: number;
  }>;
};

type ProjectSprintsPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

export default function ProjectSprintsPageClient({
  projectId,
  projectRole,
}: ProjectSprintsPageClientProps) {
  const router = useRouter();

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SprintIncrementSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  const allowSprintManagement = canManageSprints(projectRole);

  const statusStyles = useMemo(
    () => ({
      [SprintStatus.PLANNED]:
        "bg-slate-100 text-slate-700 border border-slate-200",
      [SprintStatus.ACTIVE]: "bg-blue-50 text-blue-700 border border-blue-200",
      [SprintStatus.COMPLETED]: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    }),
    []
  );

  const buildStatusStyles = useMemo(
    () => ({
      [BuildStatus.DEPLOYED]: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      [BuildStatus.IN_PROGRESS]: "bg-blue-50 text-blue-700 border border-blue-200",
      [BuildStatus.PLANNED]: "bg-slate-100 text-slate-700 border border-slate-200",
      [BuildStatus.ROLLED_BACK]: "bg-amber-50 text-amber-700 border border-amber-200",
      [BuildStatus.CANCELLED]: "bg-slate-100 text-slate-700 border border-slate-200",
    }),
    []
  );

  const buildStatusLabels = useMemo(
    () => ({
      [BuildStatus.PLANNED]: "Planned",
      [BuildStatus.IN_PROGRESS]: "In progress",
      [BuildStatus.DEPLOYED]: "Deployed",
      [BuildStatus.ROLLED_BACK]: "Rolled back",
      [BuildStatus.CANCELLED]: "Cancelled",
    }),
    []
  );

  const environmentLabels = useMemo(
    () => ({
      [BuildEnvironment.DEV]: "Dev",
      [BuildEnvironment.STAGING]: "Staging",
      [BuildEnvironment.UAT]: "UAT",
      [BuildEnvironment.PROD]: "Prod",
    }),
    []
  );

  const selectedSprint = useMemo(
    () => sprints.find((sprint) => sprint.id === selectedSprintId) ?? null,
    [selectedSprintId, sprints]
  );

  const fetchSprints = async () => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/sprints`);

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to load sprints.");
        return;
      }

      const data = await response.json();
      setSprints(data);

      if (data.length > 0) {
        const activeSprint = data.find((sprint: Sprint) => sprint.status === SprintStatus.ACTIVE);
        const defaultSprintId = activeSprint?.id ?? data[0]?.id ?? null;
        setSelectedSprintId((current) => {
          if (current && data.some((sprint: Sprint) => sprint.id === current)) {
            return current;
          }
          return defaultSprintId;
        });
      } else {
        setSelectedSprintId(null);
      }
    } catch (err) {
      setError("An unexpected error occurred while loading sprints.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchSprints();
  }, [projectId]);

  useEffect(() => {
    if (!selectedSprintId) {
      setSummary(null);
      setSummaryError("");
      return;
    }

    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError("");

      try {
        const response = await fetch(`/api/sprints/${selectedSprintId}/increment`);

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setSummaryError(data?.message ?? "Failed to load sprint summary.");
          return;
        }

        const data = await response.json();
        setSummary(data);
      } catch (err) {
        setSummaryError("Unable to load sprint summary.");
      } finally {
        setSummaryLoading(false);
      }
    };

    loadSummary();
  }, [selectedSprintId]);

  const handleStartSprint = async (sprintId: string) => {
    setError("");

    const response = await fetch(`/api/sprints/${sprintId}/start`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "Unable to start sprint.");
      return;
    }

    await fetchSprints();
  };

  const handleCompleteSprint = async (sprintId: string) => {
    setError("");

    const response = await fetch(`/api/sprints/${sprintId}/complete`, {
      method: "POST",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "Unable to complete sprint.");
      return;
    }

    await fetchSprints();
  };

  const formatDate = (value: string | null) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
    }).format(date);
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    const startLabel = formatDate(start);
    const endLabel = formatDate(end);

    if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
    if (startLabel) return `Starts ${startLabel}`;
    if (endLabel) return `Ends ${endLabel}`;

    return "No dates set";
  };

  const navigateToSprintBoard = (sprintId: string) => {
    router.push(`/projects/${projectId}/board?sprintId=${sprintId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-900">Sprints</h2>
          <p className="text-sm text-slate-600">
            Plan, start, and complete sprints for this project.
          </p>
        </div>

        {allowSprintManagement && (
          <CreateSprintDrawer
            projectId={projectId}
            onSprintCreated={fetchSprints}
            onError={setError}
          />
        )}
      </div>

      {selectedSprint && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Increment summary
              </p>
              <p className="text-sm text-slate-700">
                {selectedSprint.name}
              </p>
            </div>

            {sprints.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sprint
                </span>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-sm"
                  value={selectedSprintId ?? undefined}
                  onChange={(event) => setSelectedSprintId(event.target.value)}
                >
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {summaryLoading ? (
            <div className="space-y-3 px-5 py-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                  <div
                    key={index}
                    className="h-16 animate-pulse rounded-lg bg-slate-100"
                  />
                ))}
              </div>
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : summaryError ? (
            <div className="px-5 py-4 text-sm text-red-600">{summaryError}</div>
          ) : summary ? (
            <div className="space-y-4 px-5 py-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total issues
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">
                    {summary.totalIssues}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Done issues
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-800">
                    {summary.doneIssues}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Blocking
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-amber-800">
                    {summary.blockingIssues}
                  </p>
                </div>
                <div
                  className={`rounded-lg border px-4 py-3 shadow-sm ${
                    summary.potentiallyReleasable
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      summary.potentiallyReleasable
                        ? "text-emerald-700"
                        : "text-amber-700"
                    }`}
                  >
                    Potentially releasable
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {summary.potentiallyReleasable
                      ? "Done work is clear of blockers."
                      : "Resolve blockers on completed items."}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Builds touching this sprint
                    </p>
                    <p className="text-xs text-slate-600">
                      Builds linked to issues in this sprint via issue links.
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    {summary.builds.length} {summary.builds.length === 1 ? "build" : "builds"}
                  </div>
                </div>

                {summary.builds.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No builds linked to issues in this sprint yet.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {summary.builds.map((build) => {
                      const statusKey = build.status as (typeof BuildStatus)[keyof typeof BuildStatus];
                      const environmentKey =
                        build.environment as (typeof BuildEnvironment)[keyof typeof BuildEnvironment];
                      const statusLabel = buildStatusLabels[statusKey] ?? build.status;
                      const environmentLabel = environmentLabels[environmentKey] ?? build.environment;

                      return (
                        <div
                          key={build.id}
                          className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <Link
                              href={routes.project.build(projectId, build.id)}
                              className="text-sm font-semibold text-slate-900 hover:text-primary"
                            >
                              {build.key}
                            </Link>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={`rounded-full px-2 py-0.5 font-semibold ${
                                  buildStatusStyles[statusKey] ??
                                  "border border-slate-200 bg-slate-100 text-slate-700"
                                }`}
                              >
                                {statusLabel}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-semibold text-slate-700">
                                {environmentLabel}
                              </span>
                            </div>
                          </div>

                          <div className="text-xs text-slate-600 sm:text-right">
                            <div className="text-sm font-medium text-slate-900">
                              Issues: {build.issueCount}
                            </div>
                            <div>
                              {build.deployedAt
                                ? `Deployed ${formatDate(build.deployedAt) ?? "—"}`
                                : "Not deployed"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-600">
              Select a sprint to view increment details.
            </div>
          )}
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="px-5 py-6 text-sm text-slate-600">Loading sprints...</div>
        ) : sprints.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No sprints for this project yet. Create the first sprint to start planning.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sprints.map((sprint) => (
              <div
                key={sprint.id}
                className="flex items-center justify-between px-5 py-4 transition hover:bg-slate-50"
                role="button"
                tabIndex={0}
                onClick={() => navigateToSprintBoard(sprint.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigateToSprintBoard(sprint.id);
                  }
                }}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{sprint.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[sprint.status]}`}
                    >
                      {sprint.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {sprint.goal?.trim() ? sprint.goal : "No goal set."}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-700">
                  <div className="text-right">
                    <div className="font-medium text-slate-900">
                      {formatDateRange(sprint.startDate, sprint.endDate)}
                    </div>
                    <div className="text-xs text-slate-500">
                      Story points: {sprint.storyPoints ?? 0}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {allowSprintManagement && sprint.status === SprintStatus.PLANNED && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleStartSprint(sprint.id);
                        }}
                      >
                        Start
                      </Button>
                    )}
                    {allowSprintManagement && sprint.status === SprintStatus.ACTIVE && (
                      <Button
                        variant="secondary"
                        className="px-3 py-1 text-xs"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleCompleteSprint(sprint.id);
                        }}
                      >
                        Complete
                      </Button>
                    )}

                    <span className="text-lg text-slate-300">›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
