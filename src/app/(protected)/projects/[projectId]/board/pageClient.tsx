"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

import { IssueStatus, SprintStatus } from "@prisma/client";

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
  title: string;
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
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-2xl font-semibold text-gray-900">You don’t have access to this project.</h1>
          <p className="mt-2 text-gray-600">Ask a project admin to invite you to this project.</p>
          <Link
            href="/my-projects"
            className="mt-4 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Back to My Projects
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Sprint Board</h1>
            <p className="text-gray-600">Visualize and manage issues by status for the current sprint.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-gray-600 md:text-right">
            <span>
              Sprint: <strong>{sprint?.name ?? "No active sprint"}</strong>
            </span>
            <span>
              Status: <strong>{sprint?.status ?? "-"}</strong>
            </span>
            <span>
              Total Story Points: <strong>{issuesCount}</strong>
            </span>
            {isReadOnly && <span className="text-xs text-gray-500">Drag-and-drop disabled (view only)</span>}
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {isLoading ? (
          <p className="text-gray-600">Loading sprint board...</p>
        ) : !sprint ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
            No active sprint found. Please create or start a sprint to see issues here.
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {STATUS_OPTIONS.map((status) => (
                <Droppable key={status.value} droppableId={status.value}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex min-h-[300px] flex-col gap-3 rounded-lg bg-white p-4 shadow"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">{status.label}</h2>
                        <span className="text-sm text-gray-500">
                          {issuesByStatus[status.value].length} issue(s)
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {issuesByStatus[status.value].map((issue, index) => (
                          <Draggable key={issue.id} draggableId={issue.id} index={index} isDragDisabled={isReadOnly}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow ${snapshot.isDragging ? "border-blue-400 shadow-lg" : ""}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{issue.title}</p>
                                    <p className="text-xs text-gray-500">Story points: {issue.storyPoints ?? "-"}</p>
                                  </div>
                                  {statusUpdating[issue.id] && (
                                    <span className="text-xs text-gray-400">Updating...</span>
                                  )}
                                </div>

                                {issue.assignee && (
                                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                                      {issue.assignee.name?.slice(0, 1) ?? "?"}
                                    </span>
                                    <span>{issue.assignee.name}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              ))}
            </div>
          </DragDropContext>
        )}
      </div>
    </main>
  );
}
