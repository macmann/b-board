"use client";

import { useMemo, useState } from "react";

import type { BacklogTableIssue } from "@/components/issues/BacklogTable";
import { type SelectOption } from "@/components/issues/InlineEditableCell";
import ResearchDetailsDrawer from "@/components/research/ResearchDetailsDrawer";
import ResearchFilterBar from "@/components/research/ResearchFilterBar";
import ResearchItemDrawer from "@/components/research/ResearchItemDrawer";
import { Button } from "@/components/ui/Button";
import ResearchBoard from "./ResearchBoard";
import ResearchList from "./ResearchList";
import {
  defaultResearchFilters,
  GENERAL_RESEARCH_TYPE_VALUE,
  researchMatchesFilters,
  type ResearchFilters,
} from "./researchFilters";
import { type ResearchBacklogItem } from "./types";

type ResearchBacklogContainerProps = {
  projectId: string;
  enableResearchBoard: boolean;
  items: ResearchBacklogItem[];
  isReadOnly: boolean;
  isLoading: boolean;
  error: string;
  projectIssues: BacklogTableIssue[];
  onRefresh: () => Promise<void> | void;
  onItemsChange: (items: ResearchBacklogItem[]) => void;
};

export default function ResearchBacklogContainer({
  projectId,
  enableResearchBoard,
  items,
  isReadOnly,
  isLoading,
  error,
  projectIssues,
  onRefresh,
  onItemsChange,
}: ResearchBacklogContainerProps) {
  const [view, setView] = useState<"list" | "board">("list");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [filters, setFilters] = useState<ResearchFilters>(defaultResearchFilters);

  const filteredItems = useMemo(
    () => items.filter((item) => researchMatchesFilters(item, filters)),
    [filters, items]
  );

  const listItems = useMemo(
    () =>
      [...filteredItems].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
      ),
    [filteredItems]
  );

  const assigneeOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, string>();
    items.forEach((item) => {
      if (!item.assignee?.id) return;
      options.set(item.assignee.id, item.assignee.name);
    });

    return Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const typeOptions = useMemo<SelectOption[]>(() => {
    const options = new Map<string, string>();
    let hasGeneral = false;

    items.forEach((item) => {
      const typeValue = item.researchType?.trim();
      if (!typeValue) {
        hasGeneral = true;
        return;
      }
      options.set(typeValue, typeValue);
    });

    const entries = Array.from(options.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (hasGeneral) {
      entries.unshift({ value: GENERAL_RESEARCH_TYPE_VALUE, label: "General" });
    }

    return entries;
  }, [items]);

  const handleOpenDetails = (id: string) => {
    setSelectedItemId(id);
    setIsDetailOpen(true);
  };

  const handleDeleteItem = async (
    id: string
  ): Promise<{ success: boolean; message?: string }> => {
    if (isReadOnly) {
      const message = "You do not have permission to delete research items.";
      setActionError(message);
      return { success: false, message };
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this research item? This action cannot be undone."
    );

    if (!confirmed) return { success: false };

    try {
      const response = await fetch(`/api/research-items/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to delete research item.");
      }

      const remainingItems = items.filter((item) => item.id !== id);
      onItemsChange(remainingItems);

      if (selectedItemId === id) {
        setSelectedItemId(null);
        setIsDetailOpen(false);
      }

      setActionError("");
      await onRefresh?.();

      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete research item.";
      setActionError(message);
      return { success: false, message };
    }
  };

  const canEditBoard = enableResearchBoard && !isReadOnly;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            Research backlog
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Track research work in a list or on the board.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {enableResearchBoard && (
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-medium text-slate-600 shadow-inner dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`rounded-md px-2 py-1 transition ${
                  view === "list"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                className={`rounded-md px-2 py-1 transition ${
                  view === "board"
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                Board
              </button>
            </div>
          )}

          <ResearchItemDrawer
            projectId={projectId}
            isReadOnly={isReadOnly}
            mode="create"
            trigger={<Button disabled={isReadOnly}>Create Research Item</Button>}
            onSuccess={onRefresh}
          />
        </div>
      </div>

      {error && !isLoading && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}

      {actionError && !isLoading && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {actionError}
        </div>
      )}

      <ResearchFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={() => setFilters(defaultResearchFilters)}
        assigneeOptions={assigneeOptions}
        typeOptions={typeOptions}
      />

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Loading research...
        </div>
      ) : view === "board" && enableResearchBoard ? (
        <ResearchBoard
          projectId={projectId}
          items={filteredItems}
          canEdit={canEditBoard}
          onOpenDetails={handleOpenDetails}
          onDelete={handleDeleteItem}
          onItemsChange={onItemsChange}
        />
      ) : (
        <ResearchList items={listItems} onOpenDetails={handleOpenDetails} />
      )}

      <ResearchDetailsDrawer
        researchItemId={selectedItemId}
        isReadOnly={isReadOnly}
        issues={projectIssues}
        open={isDetailOpen}
        onClose={() => {
          setSelectedItemId(null);
          setIsDetailOpen(false);
        }}
        onUpdated={onRefresh}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}
