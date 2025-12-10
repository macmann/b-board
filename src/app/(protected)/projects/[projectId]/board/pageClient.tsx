"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

import Button from "@/components/ui/Button";
import {
  IssuePriority,
  IssueStatus,
  IssueType,
  SprintStatus,
} from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";

type StatusOption = {
  value: IssueStatus;
  label: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: IssueStatus.TODO, label: "To Do" },
  { value: IssueStatus.IN_PROGRESS, label: "In Progress" },
  { value: IssueStatus.IN_REVIEW, label: "In Review" },
  { value: IssueStatus.DONE, label: "Done" },
];

type Sprint = {
  id: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
};

type Issue = {
  id: string;
  key?: string | null;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  storyPoints: number | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
};

type IssuesByStatus = Record<IssueStatus, Issue[]>;

const createEmptyIssuesByStatus = (): IssuesByStatus => ({
  [IssueStatus.TODO]: [],
  [IssueStatus.IN_PROGRESS]: [],
  [IssueStatus.IN_REVIEW]: [],
  [IssueStatus.DONE]: [],
});

const groupIssuesByStatus = (issueList: Issue[]): IssuesByStatus => {
  const grouped = createEmptyIssuesByStatus();

  issueList.forEach((issue) => {
    grouped[issue.status] = [...grouped[issue.status], issue];
  });

  return grouped;
};

type BoardPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
};

export default function BoardPageClient({ projectId, projectRole }: BoardPageClientProps) {
  const searchParams = useSearchParams();
  const sprintIdFromQuery = searchParams?.get("sprintId") || "";

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [issuesByStatus, setIssuesByStatus] = useState<IssuesByStatus>(createEmptyIssuesByStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
  const [hasAccess, setHasAccess] = useState(true);

  const isReadOnly = projectRole === "VIEWER";

  useEffect(() => {
    if (!projectId) return;

    const loadBoard = async () => {
      setIsLoading(true);
      setError("");
      setHasAccess(true);

      try {
        let resolvedSprint: Sprint | null = null;

        if (sprintIdFromQuery) {
          const sprintResponse = await fetch(`/api/projects/${projectId}/sprints`);

          if (!sprintResponse.ok) {
            if (sprintResponse.status === 403) {
              setHasAccess(false);
              return;
            }

            const data = await sprintResponse.json().catch(() => null);
            setError(data?.message ?? "Unable to load sprints.");
            setSprint(null);
            setIssuesByStatus(createEmptyIssuesByStatus());
            return;
          }

          const sprints: Sprint[] = await sprintResponse.json();
          resolvedSprint = sprints.find((item) => item.id === sprintIdFromQuery) ?? null;

          if (!resolvedSprint) {
            setError("Sprint not found.");
            setSprint(null);
            setIssuesByStatus(createEmptyIssuesByStatus());
            return;
          }
        } else {
          const activeResponse = await fetch(`/api/projects/${projectId}/active-sprint`);

          if (!activeResponse.ok) {
            if (activeResponse.status === 403) {
              setHasAccess(false);
              return;
            }

            const data = await activeResponse.json().catch(() => null);
            setError(data?.message ?? "Unable to load active sprint.");
            setSprint(null);
            setIssuesByStatus(createEmptyIssuesByStatus());
            return;
          }

          const activeSprint = (await activeResponse.json()) as Sprint | null;
          resolvedSprint = activeSprint;
        }

        if (!resolvedSprint) {
          setSprint(null);
          setIssuesByStatus(createEmptyIssuesByStatus());
          return;
        }

        setSprint(resolvedSprint);

        const issuesResponse = await fetch(`/api/sprints/${resolvedSprint.id}/issues`);

        if (!issuesResponse.ok) {
          const data = await issuesResponse.json().catch(() => null);
          setError(data?.message ?? "Unable to load sprint issues.");
          setIssuesByStatus(createEmptyIssuesByStatus());
          return;
        }

        const issues = (await issuesResponse.json()) as Issue[];
        setIssuesByStatus(groupIssuesByStatus(issues));
      } catch (err) {
        setError("An unexpected error occurred while loading the board.");
      } finally {
        setIsLoading(false);
      }
    };

    loadBoard();
  }, [projectId, sprintIdFromQuery]);

  const issuesCount = useMemo(
    () =>
      Object.values(issuesByStatus).reduce(
        (total, issues) => total + issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0),
        0
      ),
    [issuesByStatus]
  );

  const formatLabel = (value: string) => value.replace(/_/g, " ");

  const handleIssueStatusChange = async (issueId: string, newStatus: IssueStatus) => {
    if (!sprint) return;

    setStatusUpdating((prev) => ({ ...prev, [issueId]: true }));

    const response = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, sprintId: sprint.id }),
    });

    setStatusUpdating((prev) => ({ ...prev, [issueId]: false }));

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message ?? "Failed to update issue status.");
      return;
    }

    const updatedIssuesByStatus = { ...issuesByStatus } as IssuesByStatus;
    let movedIssue: Issue | null = null;

    Object.entries(updatedIssuesByStatus).forEach(([status, issues]) => {
      const index = issues.findIndex((issue) => issue.id === issueId);
      if (index !== -1) {
        [movedIssue] = issues.splice(index, 1);
      }
    });

    if (movedIssue) {
      movedIssue.status = newStatus;
      updatedIssuesByStatus[newStatus] = [...updatedIssuesByStatus[newStatus], movedIssue];
      setIssuesByStatus(updatedIssuesByStatus);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (isReadOnly) return;

    const { destination, source, draggableId } = result;

    if (!destination) return;

    const sourceStatus = source.droppableId as IssueStatus;
    const destStatus = destination.droppableId as IssueStatus;

    if (sourceStatus === destStatus) return;

    handleIssueStatusChange(draggableId, destStatus);
  };

  if (!hasAccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">You don’t have access to this project.</h1>
          <p className="mt-2 text-sm text-slate-600">Ask a project admin to invite you to this project.</p>
          <Link
            href="/my-projects"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Back to My Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">Board</h1>
          <p className="text-sm text-slate-500">
            Drag cards between columns to keep work moving for the active sprint.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isReadOnly && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              View only
            </span>
          )}
          <Button asChild variant="primary">
            <Link href={`/projects/${projectId}/backlog`}>Create Issue</Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-semibold text-slate-900">Sprint:</span>
          <span className="text-slate-600">{sprint?.name ?? "No active sprint"}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-semibold text-slate-900">Status:</span>
          <span className="text-slate-600">{sprint?.status ?? "-"}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="font-semibold text-slate-900">Total Story Points:</span>
          <span className="text-slate-600">{issuesCount}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
          Loading sprint board...
        </div>
      ) : !sprint ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center shadow-sm">
          <p className="text-base font-semibold text-slate-900">No active sprint found</p>
          <p className="mt-2 text-sm text-slate-600">
            Please create or start a sprint to see issues here.
          </p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_OPTIONS.map((status) => {
              const issues = issuesByStatus[status.value];

              return (
                <Droppable key={status.value} droppableId={status.value}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex min-h-[300px] flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                          {status.label}
                        </div>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {issues.length}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {issues.map((issue, index) => (
                          <Draggable key={issue.id} draggableId={issue.id} index={index} isDragDisabled={isReadOnly}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-primary/70 hover:shadow-md ${
                                  snapshot.isDragging ? "border-primary shadow-lg" : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="truncate font-medium text-slate-900">
                                    {issue.key ? `${issue.key} · ` : ""}
                                    {issue.title}
                                  </p>
                                  {statusUpdating[issue.id] && (
                                    <span className="text-[11px] text-slate-400">Updating...</span>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                                    {formatLabel(issue.type)}
                                  </span>
                                  <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-700">
                                    {formatLabel(issue.priority)}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700">
                                    {issue.storyPoints ?? "—"} pts
                                  </span>
                                  {issue.assignee && (
                                    <span className="ml-auto inline-flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                        {issue.assignee.name?.[0] ?? "?"}
                                      </span>
                                      <span className="text-[12px] text-slate-700">{issue.assignee.name}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {!issues.length && (
                          <p className="pt-1 text-center text-xs text-slate-400">No issues in this column.</p>
                        )}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
