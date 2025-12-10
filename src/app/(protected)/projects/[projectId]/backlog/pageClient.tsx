"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import BacklogTable, {
  type BacklogTableIssue,
} from "@/components/issues/BacklogTable";
import CreateIssueDrawer from "@/components/issues/CreateIssueDrawer";

import { ProjectRole } from "../../../../../lib/roles";

type BacklogIssue = BacklogTableIssue;

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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-2xl font-semibold text-slate-900">
            You don’t have access to this project.
          </h1>
          <p className="mt-2 text-slate-600">
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
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Backlog</h2>
        <CreateIssueDrawer
          projectId={projectId}
          isReadOnly={isReadOnly}
          assigneeOptions={assigneeOptions}
          epicOptions={epicOptions}
          onIssueCreated={fetchIssues}
          onForbidden={() => setHasAccess(false)}
        />
      </div>

      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Loading backlog...
        </div>
      ) : (
        <BacklogTable issues={issues} onIssueClick={handleRowClick} />
      )}

      {manageTeamLink}
    </div>
  );
}
