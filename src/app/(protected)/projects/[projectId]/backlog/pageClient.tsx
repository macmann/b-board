"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import CreateIssueDrawer from "@/components/issues/CreateIssueDrawer";
import { IssuePriority, IssueStatus, IssueType } from "../../../../../lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";

type BacklogIssue = {
  id: string;
  key: string | null;
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

  const fetchIssues = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetchIssues();
  }, [fetchIssues, projectId]);

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
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Backlog</h2>
          <CreateIssueDrawer
            projectId={projectId}
            isReadOnly={isReadOnly}
            assigneeOptions={assigneeOptions}
            epicOptions={epicOptions}
            onIssueCreated={fetchIssues}
            onForbidden={() => setHasAccess(false)}
          />
        </div>

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
                      Key
                    </th>
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
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{issue.key ?? "-"}</td>
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

        {manageTeamLink}
      </div>
    </main>
  );
}
