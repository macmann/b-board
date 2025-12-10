"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CreateSprintDrawer from "@/components/sprints/CreateSprintDrawer";
import Button from "@/components/ui/Button";

import { SprintStatus } from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";
import { canManageSprints } from "../../../../../lib/uiPermissions";

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: SprintStatus;
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
                    <div className="text-xs text-slate-500">Story points: —</div>
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
