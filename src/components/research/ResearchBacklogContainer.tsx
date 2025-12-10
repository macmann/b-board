"use client";

import { useMemo, useState } from "react";

import type { BacklogTableIssue } from "@/components/issues/BacklogTable";
import ResearchDetailsDrawer from "@/components/research/ResearchDetailsDrawer";
import ResearchItemDrawer from "@/components/research/ResearchItemDrawer";
import Button from "@/components/ui/Button";
import ResearchBoard from "./ResearchBoard";
import ResearchList from "./ResearchList";
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

  const listItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
      ),
    [items]
  );

  const handleOpenDetails = (id: string) => {
    setSelectedItemId(id);
    setIsDetailOpen(true);
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

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Loading research...
        </div>
      ) : view === "board" && enableResearchBoard ? (
        <ResearchBoard
          projectId={projectId}
          items={items}
          canEdit={canEditBoard}
          onOpenDetails={handleOpenDetails}
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
      />
    </div>
  );
}
