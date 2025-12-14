"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import BacklogTable, { type BacklogTableIssue } from "@/components/issues/BacklogTable";
import CreateIssueDrawer from "@/components/issues/CreateIssueDrawer";
import ResearchBacklogContainer from "@/components/research/ResearchBacklogContainer";
import { SprintStatus } from "@/lib/prismaEnums";

import { type ResearchBacklogItem } from "@/components/research/types";

import { routes } from "@/lib/routes";
import { ProjectRole } from "../../../../../lib/roles";

export type BacklogIssue = BacklogTableIssue;

export type BacklogGroup = {
  id: string;
  name: string;
  type: "sprint" | "backlog";
  status?: SprintStatus;
  issues: BacklogIssue[];
};

const containerIdForGroup = (group: BacklogGroup) =>
  group.type === "sprint" ? `sprint:${group.id}` : "backlog";

type Option = { id: string; label: string };

type BacklogResponse = {
  groups: BacklogGroup[];
  members: { id: string; name?: string | null }[];
  epics: { id: string; title: string | null }[];
  canEdit?: boolean;
};

type BacklogPageClientProps = {
  projectId: string;
  projectRole: ProjectRole | null;
  manageTeamLink: React.ReactNode;
  backlogGroups: BacklogGroup[];
  assigneeOptions: Option[];
  epicOptions: Option[];
  enableResearchBoard: boolean;
  researchItems: ResearchBacklogItem[];
  initialSegment?: "product" | "research";
};

export default function BacklogPageClient({
  projectId,
  projectRole,
  manageTeamLink,
  backlogGroups: initialBacklogGroups,
  assigneeOptions: initialAssigneeOptions,
  epicOptions: initialEpicOptions,
  enableResearchBoard,
  researchItems: initialResearchItems,
  initialSegment = "product",
}: BacklogPageClientProps) {
  const router = useRouter();

  const [backlogGroups, setBacklogGroups] = useState<BacklogGroup[]>(
    initialBacklogGroups
  );
  const [assigneeOptions, setAssigneeOptions] = useState<Option[]>(
    initialAssigneeOptions
  );
  const [epicOptions, setEpicOptions] = useState<Option[]>(initialEpicOptions);
  const [isLoading, setIsLoading] = useState(initialBacklogGroups.length === 0);
  const [error, setError] = useState("");
  const [hasAccess, setHasAccess] = useState(true);
  const [activeSegment, setActiveSegment] = useState<"product" | "research">(
    initialSegment
  );
  const [researchItems, setResearchItems] = useState<ResearchBacklogItem[]>(
    initialResearchItems
  );
  const [isResearchLoading, setIsResearchLoading] = useState(
    initialResearchItems.length === 0
  );
  const [researchError, setResearchError] = useState("");
  const [hasLoadedResearch, setHasLoadedResearch] = useState(
    initialResearchItems.length > 0
  );
  const [toastMessage, setToastMessage] = useState<string>("");

  const isReadOnly = projectRole === "VIEWER";
  const canReorder = projectRole === "ADMIN" || projectRole === "PO";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const allIssues = useMemo(
    () => backlogGroups.flatMap((group) => group.issues),
    [backlogGroups]
  );

  const assigneeSelectOptions = useMemo(
    () => assigneeOptions.map((option) => ({ value: option.id, label: option.label })),
    [assigneeOptions]
  );

  const epicSelectOptions = useMemo(
    () => epicOptions.map((option) => ({ value: option.id, label: option.label })),
    [epicOptions]
  );

  const findGroupContainingIssue = useCallback(
    (issueId: string) =>
      backlogGroups.find((group) =>
        group.issues.some((issue) => issue.id === issueId)
      ),
    [backlogGroups]
  );

  const findGroupByContainer = useCallback(
    (containerId: string) =>
      backlogGroups.find((group) => containerIdForGroup(group) === containerId),
    [backlogGroups]
  );

  const projectIssues = useMemo(() => allIssues, [allIssues]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (activeSegment === "research") {
      searchParams.set("view", "research");
    } else {
      searchParams.delete("view");
    }

    const queryString = searchParams.toString();
    const nextUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
    router.replace(nextUrl);
  }, [activeSegment, router]);

  useEffect(() => {
    if (!toastMessage) return;

    const timeout = setTimeout(() => setToastMessage(""), 4000);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

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

      const data: BacklogResponse = await response.json();
      setBacklogGroups(data.groups ?? []);
      setAssigneeOptions(
        data.members?.map((member) => ({
          id: member.id,
          label: member.name ?? "Unassigned",
        })) ?? []
      );
      setEpicOptions(
        data.epics?.map((epic) => ({
          id: epic.id,
          label: epic.title ?? "Untitled epic",
        })) ?? []
      );
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
        `/api/projects/${projectId}/research-board`
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

      const data = (await response.json()) as { items: ResearchBacklogItem[] };
      setResearchItems(data.items ?? []);
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

  const handleIssueUpdate = useCallback(
    async (
      issueId: string,
      updates: {
        type?: BacklogIssue["type"];
        status?: BacklogIssue["status"];
        priority?: BacklogIssue["priority"];
        storyPoints?: number | null;
        assigneeId?: string | null;
        epicId?: string | null;
      }
    ) => {
      const previousState = backlogGroups;
      setToastMessage("");

      setBacklogGroups((groups) =>
        groups.map((group) => ({
          ...group,
          issues: group.issues.map((issue) =>
            issue.id === issueId ? { ...issue, ...updates } : issue
          ),
        }))
      );

      try {
        const response = await fetch(`/api/issues/${issueId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          setBacklogGroups(previousState);
          setToastMessage(data?.message ?? "Failed to update issue.");
          return false;
        }

        const updatedIssue = await response.json();

        setBacklogGroups((groups) =>
          groups.map((group) => ({
            ...group,
            issues: group.issues.map((issue) =>
              issue.id === issueId ? { ...issue, ...updatedIssue } : issue
            ),
          }))
        );

        return true;
      } catch (err) {
        setBacklogGroups(previousState);
        setToastMessage("An unexpected error occurred while updating the issue.");
        return false;
      }
    },
    [backlogGroups]
  );

  const handleRowClick = (issueId: string) => {
    router.push(`/issues/${issueId}`);
  };

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      if (!canReorder) return;

      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const sourceGroup = findGroupContainingIssue(activeId);
      const targetGroup =
        findGroupContainingIssue(overId) ?? findGroupByContainer(overId);

      if (!sourceGroup || !targetGroup) return;

      const movingIssue = sourceGroup.issues.find(
        (issue) => issue.id === activeId
      );

      if (!movingIssue) return;

      const updatedIssue = {
        ...movingIssue,
        sprintId: targetGroup.type === "sprint" ? targetGroup.id : null,
      };

      const filteredSourceIssues = sourceGroup.issues.filter(
        (issue) => issue.id !== activeId
      );

      const filteredTargetIssues =
        sourceGroup.id === targetGroup.id
          ? [...filteredSourceIssues]
          : targetGroup.issues.filter((issue) => issue.id !== activeId);

      const overIndex = filteredTargetIssues.findIndex(
        (issue) => issue.id === overId
      );
      const insertIndex = overIndex >= 0 ? overIndex : filteredTargetIssues.length;
      filteredTargetIssues.splice(insertIndex, 0, updatedIssue);

      const previousGroups = backlogGroups;

      const newGroups = backlogGroups.map((group) => {
        if (group.id === sourceGroup.id && group.id === targetGroup.id) {
          return { ...group, issues: filteredTargetIssues };
        }

        if (group.id === sourceGroup.id) {
          return { ...group, issues: filteredSourceIssues };
        }

        if (group.id === targetGroup.id) {
          return { ...group, issues: filteredTargetIssues };
        }

        return group;
      });

      setBacklogGroups(newGroups);

      const payload = {
        toSprintId: targetGroup.type === "sprint" ? targetGroup.id : null,
        toContainer: targetGroup.type === "sprint" ? "sprint" : "backlog",
        newIndex: insertIndex,
        orderedIdsInTargetContainer: filteredTargetIssues.map((issue) => issue.id),
      };

      const response = await fetch(`/api/issues/${activeId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setBacklogGroups(previousGroups);
        const data = await response.json().catch(() => null);
        setToastMessage(data?.message ?? "Unable to move issue.");
      }
    },
    [backlogGroups, canReorder, findGroupByContainer, findGroupContainingIssue]
  );

  const BacklogGroupSection = ({ group }: { group: BacklogGroup }) => {
    const isSprint = group.type === "sprint";
    const containerId = containerIdForGroup(group);
    const { setNodeRef, isOver } = useDroppable({ id: containerId });

    return (
      <section
        ref={setNodeRef}
        className={`space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
          isOver ? "ring-2 ring-blue-400" : ""
        }`}
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

        <BacklogTable
          issues={group.issues}
          onIssueClick={handleRowClick}
          onIssueUpdate={handleIssueUpdate}
          assigneeOptions={assigneeSelectOptions}
          epicOptions={epicSelectOptions}
          isReadOnly={isReadOnly}
          disableDrag={!canReorder}
        />
      </section>
    );
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
            href={routes.myProjects()}
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

        </div>
      </div>

      {activeSegment === "product" && error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeSegment === "product" && toastMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {toastMessage}
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-6">
              {backlogGroups.map((group) => {
                return <BacklogGroupSection key={group.id} group={group} />;
              })}
            </div>
          </DndContext>
        )
      ) : (
        <ResearchBacklogContainer
          projectId={projectId}
          enableResearchBoard={enableResearchBoard}
          items={researchItems}
          isReadOnly={isReadOnly}
          isLoading={isResearchLoading}
          error={researchError}
          projectIssues={projectIssues}
          onRefresh={fetchResearchItems}
          onItemsChange={setResearchItems}
        />
      )}

      {manageTeamLink}
    </div>
  );
}
