"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { IssueStatus, SprintStatus } from "@prisma/client";

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

export default function SprintBoardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params?.projectId as string;
  const sprintIdFromQuery = searchParams?.get("sprintId") || "";

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!projectId) return;

    const loadBoard = async () => {
      setIsLoading(true);
      setError("");

      try {
        let resolvedSprint: Sprint | null = null;

        if (sprintIdFromQuery) {
          const sprintResponse = await fetch(`/api/projects/${projectId}/sprints`);

          if (!sprintResponse.ok) {
            const data = await sprintResponse.json().catch(() => null);
            setError(data?.message ?? "Unable to load sprints.");
            setSprint(null);
            setIssues([]);
            return;
          }

          const sprints: Sprint[] = await sprintResponse.json();
          resolvedSprint = sprints.find((item) => item.id === sprintIdFromQuery) ?? null;

          if (!resolvedSprint) {
            setError("Sprint not found.");
            setSprint(null);
            setIssues([]);
            return;
          }
        } else {
          const activeResponse = await fetch(`/api/projects/${projectId}/active-sprint`);

          if (!activeResponse.ok) {
            const data = await activeResponse.json().catch(() => null);
            setError(data?.message ?? "Unable to load active sprint.");
            setSprint(null);
            setIssues([]);
            return;
          }

          resolvedSprint = await activeResponse.json();

          if (!resolvedSprint) {
            setError("No active sprint found for this project.");
            setSprint(null);
            setIssues([]);
            return;
          }
        }

        setSprint(resolvedSprint);

        const issuesResponse = await fetch(`/api/sprints/${resolvedSprint.id}/issues`);

        if (!issuesResponse.ok) {
          const data = await issuesResponse.json().catch(() => null);
          setError(data?.message ?? "Unable to load sprint issues.");
          setIssues([]);
          return;
        }

        const sprintIssues: Issue[] = await issuesResponse.json();
        setIssues(sprintIssues);
      } catch (err) {
        setError("An unexpected error occurred while loading the sprint board.");
      } finally {
        setIsLoading(false);
      }
    };

    loadBoard();
  }, [projectId, sprintIdFromQuery]);

  const groupedIssues = useMemo(() => {
    return STATUS_OPTIONS.map((statusOption) => ({
      status: statusOption.value,
      label: statusOption.label,
      items: issues.filter((issue) => issue.status === statusOption.value),
    }));
  }, [issues]);

  const handleStatusChange = async (issueId: string, status: IssueStatus) => {
    setStatusUpdating((prev) => ({ ...prev, [issueId]: true }));
    setError("");

    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to update issue status.");
        return;
      }

      const updatedIssue: Issue = await response.json();
      setIssues((prevIssues) =>
        prevIssues.map((issue) =>
          issue.id === issueId
            ? { ...issue, status: updatedIssue.status, assignee: updatedIssue.assignee, storyPoints: updatedIssue.storyPoints, title: updatedIssue.title }
            : issue
        )
      );
    } catch (err) {
      setError("An unexpected error occurred while updating the issue.");
    } finally {
      setStatusUpdating((prev) => {
        const next = { ...prev };
        delete next[issueId];
        return next;
      });
    }
  };

  const renderAssignee = (issueAssignee: Issue["assignee"]) => {
    if (!issueAssignee) {
      return <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500">?</div>;
    }

    if (issueAssignee.avatarUrl) {
      return <img src={issueAssignee.avatarUrl} alt={issueAssignee.name} className="h-8 w-8 rounded-full object-cover" />;
    }

    const initials = issueAssignee.name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase())
      .join("")
      .slice(0, 2);

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
        {initials || "?"}
      </div>
    );
  };

  const handleCardClick = (issueId: string) => {
    router.push(`/issues/${issueId}`);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-gray-900">Sprint Board</h1>
          {sprint ? (
            <p className="text-gray-600">{sprint.name}</p>
          ) : (
            <p className="text-gray-600">Select or start a sprint to view its board.</p>
          )}
        </header>

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow">
            <p className="text-gray-600">Loading sprint board...</p>
          </div>
        ) : !sprint ? (
          <div className="flex h-64 items-center justify-center rounded-lg bg-white shadow">
            <p className="text-gray-600">No sprint selected.</p>
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {groupedIssues.map((column) => (
              <div key={column.status} className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{column.label}</h2>
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">{column.items.length}</span>
                </div>

                <div className="flex flex-col gap-3">
                  {column.items.length === 0 ? (
                    <p className="text-sm text-gray-500">No issues</p>
                  ) : (
                    column.items.map((issue) => (
                      <div
                        key={issue.id}
                        className="flex cursor-pointer flex-col gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow"
                        onClick={() => handleCardClick(issue.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-gray-500">{issue.id}</span>
                            <h3 className="text-sm font-semibold text-gray-900">{issue.title}</h3>
                          </div>
                          {renderAssignee(issue.assignee)}
                        </div>

                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{issue.storyPoints ?? "-"} pts</span>
                          <select
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={issue.status}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => handleStatusChange(issue.id, event.target.value as IssueStatus)}
                            disabled={statusUpdating[issue.id]}
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
