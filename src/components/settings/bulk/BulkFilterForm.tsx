"use client";

import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import type { IssuePriority, IssueStatus, IssueType } from "@/lib/prismaEnums";
import type { BulkFilterState } from "@/app/(protected)/projects/[projectId]/settings/tabs/BulkOperationsTab";

type BulkFilterFormProps = {
  filter: BulkFilterState;
  statusOptions: IssueStatus[];
  typeOptions: IssueType[];
  priorityOptions: IssuePriority[];
  members: { id: string; label: string }[];
  sprints: { id: string; label: string }[];
  epics: { id: string; label: string }[];
  onFilterChange: (changes: Partial<BulkFilterState>) => void;
  onSubmit: () => void;
  isLoading?: boolean;
};

export default function BulkFilterForm({
  filter,
  statusOptions,
  typeOptions,
  priorityOptions,
  members,
  sprints,
  epics,
  onFilterChange,
  onSubmit,
  isLoading,
}: BulkFilterFormProps) {
  const toggleStatus = (status: IssueStatus) => {
    const exists = filter.statuses.includes(status);
    const next = exists
      ? filter.statuses.filter((s) => s !== status)
      : [...filter.statuses, status];
    onFilterChange({ statuses: next });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Status
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
            {statusOptions.map((status) => {
              const isActive = filter.statuses.includes(status);
              return (
                <label
                  key={status}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 capitalize transition dark:border-slate-700 ${
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-slate-200 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-3 w-3"
                    checked={isActive}
                    onChange={() => toggleStatus(status)}
                  />
                  <span>{status.replace(/_/g, " ")}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Type
            </label>
            <select
              value={filter.type ?? ""}
              onChange={(event) => onFilterChange({ type: event.target.value as IssueType })}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Any</option>
              {typeOptions.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Priority
            </label>
            <select
              value={filter.priority ?? ""}
              onChange={(event) =>
                onFilterChange({ priority: event.target.value as IssuePriority })
              }
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Any</option>
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority} className="capitalize">
                  {priority}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Assignee
          </label>
          <select
            value={filter.assigneeId ?? ""}
            onChange={(event) => onFilterChange({ assigneeId: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Any</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Sprint
          </label>
          <select
            value={filter.sprintId ?? ""}
            onChange={(event) => onFilterChange({ sprintId: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Any</option>
            <option value="BACKLOG">Backlog</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Epic
          </label>
          <select
            value={filter.epicId ?? ""}
            onChange={(event) => onFilterChange({ epicId: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Any</option>
            {epics.map((epic) => (
              <option key={epic.id} value={epic.id}>
                {epic.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Search (title or key)
          </label>
          <input
            type="text"
            value={filter.search ?? ""}
            onChange={(event) => onFilterChange({ search: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="e.g. login bug or BB-12"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Filtering..." : "Preview matching issues"}
        </Button>
      </div>
    </form>
  );
}
