"use client";

import { MouseEvent, useEffect, useMemo, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";

import { ResearchStatus } from "@/lib/prismaEnums";

import { type ResearchBacklogItem } from "./types";

type BoardStatus =
  | typeof ResearchStatus.BACKLOG
  | typeof ResearchStatus.IN_PROGRESS
  | typeof ResearchStatus.REVIEW
  | typeof ResearchStatus.COMPLETED;

type ResearchBoardProps = {
  projectId: string;
  items: ResearchBacklogItem[];
  canEdit: boolean;
  onOpenDetails: (id: string) => void;
  onDelete?: (
    id: string
  ) => Promise<{ success: boolean; message?: string } | void>;
  onItemsChange?: (items: ResearchBacklogItem[]) => void;
};

type ResearchColumns = Record<BoardStatus, ResearchBacklogItem[]>;

const STATUS_COLUMNS: { id: BoardStatus; title: string }[] = [
  { id: ResearchStatus.BACKLOG, title: "Backlog" },
  { id: ResearchStatus.IN_PROGRESS, title: "In Progress" },
  { id: ResearchStatus.REVIEW, title: "In Review" },
  { id: ResearchStatus.COMPLETED, title: "Completed" },
];

const createEmptyColumns = (): ResearchColumns => ({
  [ResearchStatus.BACKLOG]: [],
  [ResearchStatus.IN_PROGRESS]: [],
  [ResearchStatus.REVIEW]: [],
  [ResearchStatus.COMPLETED]: [],
});

const groupItemsByStatus = (items: ResearchBacklogItem[]): ResearchColumns => {
  const grouped = createEmptyColumns();

  const sortedItems = [...items].sort((a, b) => {
    const aPosition = a.position ?? 0;
    const bPosition = b.position ?? 0;

    if (aPosition === bPosition) {
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    }

    return aPosition - bPosition;
  });

  sortedItems.forEach((item) => {
    const column = STATUS_COLUMNS.find((status) => status.id === item.status);

    if (!column) return;

    grouped[column.id] = [...grouped[column.id], item];
  });

  return grouped;
};

const flattenColumns = (columns: ResearchColumns) =>
  STATUS_COLUMNS.flatMap((column) => columns[column.id]);

const moveItem = (
  columns: ResearchColumns,
  {
    itemId,
    fromStatus,
    toStatus,
    toIndex,
  }: {
    itemId: string;
    fromStatus: BoardStatus;
    toStatus: BoardStatus;
    toIndex: number;
  }
) => {
  const nextColumns: ResearchColumns = {
    ...columns,
    [fromStatus]: [...columns[fromStatus]],
    [toStatus]: [...columns[toStatus]],
  };

  const sourceItems = nextColumns[fromStatus];
  const [moved] = sourceItems.splice(sourceItems.findIndex((item) => item.id === itemId), 1);

  if (!moved) return columns;

  const targetItems = nextColumns[toStatus];
  targetItems.splice(toIndex, 0, { ...moved, status: toStatus });

  return nextColumns;
};

const formatAssigneeInitials = (name?: string | null) =>
  name?.trim()
    .split(" ")
    .map((part) => part[0])
    .join("") || "?";

export function ResearchBoard({
  projectId,
  items,
  canEdit,
  onOpenDetails,
  onDelete,
  onItemsChange,
}: ResearchBoardProps) {
  const [columns, setColumns] = useState<ResearchColumns>(() => groupItemsByStatus(items));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setColumns(groupItemsByStatus(items));
  }, [items]);

  const handleDragEnd = async (result: DropResult) => {
    if (!canEdit) return;

    const { destination, source, draggableId } = result;

    if (!destination) return;

    const sourceStatus = source.droppableId as BoardStatus;
    const destStatus = destination.droppableId as BoardStatus;

    if (
      sourceStatus === destStatus &&
      source.index === destination.index
    ) {
      return;
    }

    const previousColumns = columns;
    const updatedColumns = moveItem(columns, {
      itemId: draggableId,
      fromStatus: sourceStatus,
      toStatus: destStatus,
      toIndex: destination.index,
    });

    setColumns(updatedColumns);
    setIsSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/research-items/${draggableId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          newStatus: destStatus,
          newPosition: destination.index,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to move research item.");
      }

      onItemsChange?.(flattenColumns(updatedColumns));
    } catch (err) {
      setColumns(previousColumns);
      onItemsChange?.(flattenColumns(previousColumns));
      setError(err instanceof Error ? err.message : "Failed to move research item.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderCard = (item: ResearchBacklogItem) => {
    const handleCardDelete = async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      await onDelete?.(item.id);
    };

    return (
      <div
        className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-primary/70 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
        onClick={() => onOpenDetails(item.id)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-xs font-mono font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {item.key}
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{item.title}</p>
          </div>
          {canEdit && onDelete && (
            <button
              type="button"
              onClick={handleCardDelete}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
            >
              Delete
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {item.researchType ?? "General"}
          </span>
          {item.assignee && (
            <span className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary dark:bg-primary/20">
                {formatAssigneeInitials(item.assignee.name)}
              </span>
              <span className="text-[12px] text-slate-700 dark:text-slate-200">{item.assignee.name}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const boardContent = useMemo(
    () => (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STATUS_COLUMNS.map((column) => {
          const columnItems = columns[column.id] ?? [];

          return (
            <div
              key={column.id}
              className="flex min-h-[260px] flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  {column.title}
                </div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {columnItems.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {columnItems.length === 0 && (
                  <p className="pt-1 text-center text-xs text-slate-400 dark:text-slate-500">
                    No items in this column.
                  </p>
                )}

                {columnItems.map((item) => (
                  <div key={item.id}>{renderCard(item)}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    ),
    [columns, onDelete, canEdit]
  );

  return (
    <div className="space-y-2">
      {isSaving && (
        <div className="text-xs text-slate-500 dark:text-slate-400">Saving changes…</div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {canEdit ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {STATUS_COLUMNS.map((column) => {
              const columnItems = columns[column.id] ?? [];

              return (
                <Droppable key={column.id} droppableId={column.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex min-h-[260px] flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                          {column.title}
                        </div>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {columnItems.length}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3">
                        {columnItems.length === 0 && (
                          <p className="pt-1 text-center text-xs text-slate-400 dark:text-slate-500">
                            No items in this column.
                          </p>
                        )}
                        {columnItems.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm transition hover:border-primary/70 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
                                  snapshot.isDragging ? "border-primary shadow-lg" : ""
                                }`}
                                onClick={() => onOpenDetails(item.id)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{item.title}</p>
                                  {canEdit && onDelete && (
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void onDelete(item.id);
                                      }}
                                      className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                                  <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {item.researchType ?? "General"}
                                  </span>
                                  {item.assignee && (
                                    <span className="inline-flex items-center gap-2">
                                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary dark:bg-primary/20">
                                        {formatAssigneeInitials(item.assignee.name)}
                                      </span>
                                      <span className="text-[12px] text-slate-700 dark:text-slate-200">{item.assignee.name}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      ) : (
        boardContent
      )}
    </div>
  );
}

export default ResearchBoard;
