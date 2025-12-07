"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { IssuePriority, IssueStatus, IssueType } from "@prisma/client";

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

export default function BacklogPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.projectId as string;

  const [issues, setIssues] = useState<BacklogIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [type, setType] = useState<IssueType>(IssueType.STORY);
  const [priority, setPriority] = useState<IssuePriority>(IssuePriority.MEDIUM);
  const [storyPoints, setStoryPoints] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [epicId, setEpicId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      const response = await fetch(`/api/projects/${projectId}/backlog`);

      if (!response.ok) {
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

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">Backlog</h1>
          <p className="text-gray-600">
            View and create issues for this project that are not assigned to any sprint.
          </p>
        </header>

        <section className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">Create Issue</h2>
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
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="assigneeId">
                Assignee
              </label>
              <select
                id="assigneeId"
                name="assigneeId"
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="text-sm font-medium text-gray-700" htmlFor="epicId">
                Epic
              </label>
              <select
                id="epicId"
                name="epicId"
                value={epicId}
                onChange={(event) => setEpicId(event.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">None</option>
                {epicOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSubmitting ? "Creating..." : "Create Issue"}
              </button>
            </div>
          </form>
          {error && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-lg bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Backlog Issues</h2>
            {isLoading && <span className="text-sm text-gray-500">Loading...</span>}
          </div>
          {!isLoading && issues.length === 0 ? (
            <p className="mt-4 text-gray-600">No backlog issues found for this project.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Issue ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Epic
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Assignee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Story Points
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {issues.map((issue) => (
                    <tr
                      key={issue.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRowClick(issue.id)}
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">{issue.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{issue.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{issue.type}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{issue.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{issue.priority}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{issue.epic?.title ?? "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{issue.assignee?.name ?? "Unassigned"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{issue.storyPoints ?? "—"}</td>
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
