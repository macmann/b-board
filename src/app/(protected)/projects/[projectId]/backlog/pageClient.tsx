"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import BacklogTable, {
  type BacklogTableIssue,
} from "@/components/issues/BacklogTable";
import CreateIssueDrawer from "@/components/issues/CreateIssueDrawer";
import ResearchDetailsDrawer from "@/components/research/ResearchDetailsDrawer";
import ResearchTable, {
  type ResearchTableItem,
} from "@/components/research/ResearchTable";
import ResearchItemDrawer from "@/components/research/ResearchItemDrawer";
import Button from "@/components/ui/Button";
import { SprintStatus } from "@/lib/prismaEnums";

import { ProjectRole } from "../../../../../lib/roles";

export type BacklogIssue = BacklogTableIssue;

export type BacklogGroup = {
  id: string;
  name: string;
  type: "sprint" | "backlog";
  status?: SprintStatus;
  issues: BacklogIssue[];
};

type Option = { id: string; label: string };

type BacklogPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
  manageTeamLink: React.ReactNode;
  backlogGroups: BacklogGroup[];
  enableResearchBoard: boolean;
};

export default function BacklogPageClient({
  projectId,
  projectRole,
  manageTeamLink,
  backlogGroups: initialBacklogGroups,
  enableResearchBoard,
}: BacklogPageClientProps) {
  const router = useRouter();

  const [backlogGroups, setBacklogGroups] = useState<BacklogGroup[]>(
    initialBacklogGroups
  );
  const [isLoading, setIsLoading] = useState(initialBacklogGroups.length === 0);
  const [error, setError] = useState("");
  const [hasAccess, setHasAccess] = useState(true);
  const [activeSegment, setActiveSegment] = useState<"product" | "research">(
    "product"
  );
  const [researchItems, setResearchItems] = useState<ResearchTableItem[]>([]);
  const [isResearchLoading, setIsResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState("");
  const [hasLoadedResearch, setHasLoadedResearch] = useState(false);
  const [selectedResearchId, setSelectedResearchId] = useState<string | null>(null);
  const [isResearchDetailOpen, setIsResearchDetailOpen] = useState(false);

  const isReadOnly = projectRole === "VIEWER";

  const allIssues = useMemo(
    () => backlogGroups.flatMap((group) => group.issues),
    [backlogGroups]
  );

  const assigneeOptions = useMemo<Option[]>(() => {
    const options: Option[] = [];

    allIssues.forEach((issue) => {
      if (issue.assignee && !options.find((option) => option.id === issue.assignee.id)) {
        options.push({ id: issue.assignee.id, label: issue.assignee.name });
      }
    });

    return options;
  }, [allIssues]);

  const epicOptions = useMemo<Option[]>(() => {
    const options: Option[] = [];

    allIssues.forEach((issue) => {
      if (issue.epic && !options.find((option) => option.id === issue.epic.id)) {
        options.push({ id: issue.epic.id, label: issue.epic.title });
      }
    });

    return options;
  }, [allIssues]);

  const projectIssues = useMemo(() => allIssues, [allIssues]);

  const fetchBacklogGroups = useCallback(async () => {
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

      const data: BacklogGroup[] = await response.json();
      setBacklogGroups(data);
    } catch (err) {
      setError("An unexpected error occurred while loading the backlog.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    fetchBacklogGroups();
  }, [fetchBacklogGroups, projectId]);

  const fetchResearchItems = useCallback(async () => {
    setIsResearchLoading(true);
    setResearchError("");
    setHasAccess(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/research-items`
      );

      if (!response.ok) {
        if (response.status === 403) {
          setHasAccess(false);
          return;
        }

        const data = await response.json().catch(() => null);
        setResearchError(data?.message ?? "Failed to load research items.");
        return;
      }

      const data: ResearchTableItem[] = await response.json();
      setResearchItems(data);
      setHasLoadedResearch(true);
    } catch (err) {
      setResearchError("An unexpected error occurred while loading research.");
    } finally {
      setIsResearchLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!enableResearchBoard) return;
    if (activeSegment !== "research") return;
    if (hasLoadedResearch) return;

    fetchResearchItems();
  }, [activeSegment, enableResearchBoard, fetchResearchItems, hasLoadedResearch]);

  const handleRowClick = (issueId: string) => {
    router.push(`/issues/${issueId}`);
  };

  const handleResearchRowClick = (researchId: string) => {
    setSelectedResearchId(researchId);
    setIsResearchDetailOpen(true);
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Backlog</h2>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-600 shadow-inner dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setActiveSegment("product")}
              className={`rounded-full px-3 py-1 transition ${
                activeSegment === "product"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                  : "hover:text-slate-900"
              }`}
            >
              Product
            </button>
            {enableResearchBoard && (
              <button
                type="button"
                onClick={() => setActiveSegment("research")}
                className={`rounded-full px-3 py-1 transition ${
                  activeSegment === "research"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                    : "hover:text-slate-900"
                }`}
              >
                Research
              </button>
            )}
          </div>
          {activeSegment === "product" && (
            <CreateIssueDrawer
              projectId={projectId}
              isReadOnly={isReadOnly}
              assigneeOptions={assigneeOptions}
              epicOptions={epicOptions}
              onIssueCreated={fetchBacklogGroups}
              onForbidden={() => setHasAccess(false)}
            />
          )}

          {activeSegment === "research" && enableResearchBoard && (
            <ResearchItemDrawer
              projectId={projectId}
              isReadOnly={isReadOnly}
              mode="create"
              trigger={<Button disabled={isReadOnly}>Create Research Item</Button>}
              onSuccess={fetchResearchItems}
              onForbidden={() => setHasAccess(false)}
            />
          )}
        </div>
      </div>

      {activeSegment === "product" && error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeSegment === "research" && researchError && !isResearchLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {researchError}
        </div>
      )}

      {activeSegment === "product" ? (
        isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
            Loading backlog...
          </div>
        ) : (
          <div className="space-y-6">
            {backlogGroups.map((group) => {
              const isSprint = group.type === "sprint";

              return (
                <section
                  key={group.id}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {isSprint ? `Sprint: ${group.name}` : "Product Backlog"}
                    </h2>
                    {isSprint && group.status && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {group.status}
                      </span>
                    )}
                  </div>

                  {group.issues.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                      {isSprint
                        ? "No issues assigned to this sprint yet."
                        : "No issues in the product backlog yet."}
                    </div>
                  ) : (
                    <BacklogTable issues={group.issues} onIssueClick={handleRowClick} />
                  )}
                </section>
              );
            })}
          </div>
        )
      ) : isResearchLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Loading research...
        </div>
      ) : (
        <ResearchTable items={researchItems} onRowClick={handleResearchRowClick} />
      )}

      {manageTeamLink}

      {enableResearchBoard && (
        <ResearchDetailsDrawer
          researchItemId={selectedResearchId}
          isReadOnly={isReadOnly}
          issues={projectIssues}
          open={isResearchDetailOpen}
          onClose={() => {
            setIsResearchDetailOpen(false);
            setSelectedResearchId(null);
          }}
          onUpdated={fetchResearchItems}
        />
      )}
    </div>
  );
}
