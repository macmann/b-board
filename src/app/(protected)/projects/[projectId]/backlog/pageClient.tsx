"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { IssuePriority, IssueStatus, IssueType } from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";

type BacklogIssue = {
  id: string;
  title: string;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  storyPoints: number | null;
  epic: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
};

type Option = { id: string; label: string };

type BacklogPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
  manageTeamLink: React.ReactNode;
};

export default function BacklogPageClient({
  projectId,
  projectRole,
  manageTeamLink,
}: BacklogPageClientProps) {
  const router = useRouter();

  const [issues, setIssues] = useState<BacklogIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAccess, setHasAccess] = useState(true);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>(IssueType.STORY);
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReadOnly = projectRole === "VIEWER";

  const assigneeOptions = useMemo<Option[]>(() => {
    const options: Option[] = [];

    issues.forEach((issue) => {
      if (issue.assignee && !options.find((option) => option.id === issue.assignee.id)) {
        options.push({ id: issue.assignee.id, label: issue.assignee.name });
      }
    });

    return options;
  }, [issues]);

  const epicOptions = useMemo<Option[]>(() => {
    const options: Option[] = [];

    issues.forEach((issue) => {
      if (issue.epic && !options.find((option) => option.id === issue.epic.id)) {
        options.push({ id: issue.epic.id, label: issue.epic.title });
      }
    });

    return options;
  }, [issues]);

  const fetchIssues = async () => {
    setIsLoading(true);
    setError("");
    setHasAccess(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/backlog`);

      if (!response.ok) {
        if (response.status === 403) {
          setHasAccess(false);
          return;
        }

        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Failed to load backlog issues.");
        return;
      }

      const data = await response.json();
      setIssues(data);
    } catch (err) {
      setError("An unexpected error occurred while loading the backlog.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchIssues();
  }, [projectId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/issues`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          type,
          priority,
          storyPoints: storyPoints ? Number(storyPoints) : undefined,
          assigneeId: assigneeId || undefined,
          epicId: epicId || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 403) {
          setHasAccess(false);
          return;
        }

        const data = await response.json().catch(() => null);
        setError(data?.message ?? "Unable to create issue.");
        return;
      }

      setTitle("");
      setType(IssueType.STORY);
      setPriority(IssuePriority.MEDIUM);
      setStoryPoints("");
      setAssigneeId("");
      setEpicId("");

      await fetchIssues();
    } catch (err) {
      setError("An unexpected error occurred while creating the issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRowClick = (issueId: string) => {
    router.push(`/issues/${issueId}`);
  };

  if (!hasAccess) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-2xl font-semibold text-gray-900">
            You don’t have access to this project.
          </h1>
          <p className="mt-2 text-gray-600">
            Ask a project admin to invite you to this project.
          </p>
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
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Backlog</h1>
            <p className="text-gray-600">
              View and create issues for this project that are not assigned to any sprint.
            </p>
          </div>
          {manageTeamLink}
        </header>

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Issue</h2>
            {isReadOnly && <p className="text-sm text-gray-500">View-only access</p>}
          </div>
          <form className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium text-gray-700" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="type">
                Type
              </label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as IssueType)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                {Object.values(IssueType).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="priority">
                Priority
              </label>
              <select
                id="priority"
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as IssuePriority)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                {Object.values(IssuePriority).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="storyPoints">
                Story Points
              </label>
              <input
                id="storyPoints"
                name="storyPoints"
                type="number"
                min="0"
                value={storyPoints}
                onChange={(event) => setStoryPoints(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="assignee">
                Assignee
              </label>
              <select
                id="assignee"
                name="assignee"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">Unassigned</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="epic">
                Epic
              </label>
              <select
                id="epic"
                name="epic"
                value={epicId}
                onChange={(event) => setEpicId(event.target.value)}
                disabled={isReadOnly}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
              >
                <option value="">No epic</option>
                {epicOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={isSubmitting || isReadOnly}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Creating..." : "Create issue"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Backlog issues</h2>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {isLoading ? (
            <p className="text-gray-600">Loading backlog...</p>
          ) : issues.length === 0 ? (
            <p className="text-gray-600">No issues found in the backlog.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Story Points
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Assignee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Epic
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {issues.map((issue) => (
                    <tr
                      key={issue.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(issue.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-blue-700 hover:underline">
                        {issue.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{issue.type}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{issue.status}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{issue.priority}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {issue.storyPoints !== null ? issue.storyPoints : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {issue.assignee?.name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{issue.epic?.title ?? "None"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
