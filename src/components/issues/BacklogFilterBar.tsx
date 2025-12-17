"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from "@/lib/prismaEnums";

import { type SelectOption } from "./InlineEditableCell";
import {
  BacklogFilters,
  UNASSIGNED_FILTER_VALUE,
  defaultBacklogFilters,
} from "./backlogFilters";

type BacklogFilterBarProps = {
  filters: BacklogFilters;
  onFiltersChange: (next: BacklogFilters) => void;
  onClearFilters: () => void;
  assigneeOptions: SelectOption[];
  epicOptions: SelectOption[];
};

type FilterDropdownProps = {
  label: string;
  badge?: string;
  children: React.ReactNode;
};

const formatLabel = (label: string) => label.replace(/_/g, " ");

function FilterDropdown({ label, badge, children }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
      >
        <span>{label}</span>
        {badge && (
          <span className="rounded-full bg-slate-100 px-2 py-[2px] text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {badge}
          </span>
        )}
        <svg
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M1.41 0.589996L6 5.17L10.59 0.589996L12 1.99999L6 7.99999L0 1.99999L1.41 0.589996Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 min-w-[240px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {children}
        </div>
      )}
    </div>
  );
}

export default function BacklogFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
  assigneeOptions,
  epicOptions,
}: BacklogFilterBarProps) {
  const statusOptions = useMemo(
    () =>
      Object.values(IssueStatus).map((status) => ({
        value: status,
        label: formatLabel(status),
      })),
    []
  );

  const typeOptions = useMemo(
    () =>
      Object.values(IssueType).map((type) => ({
        value: type,
        label: formatLabel(type),
      })),
    []
  );

  const priorityOptions = useMemo(
    () =>
      Object.values(IssuePriority).map((priority) => ({
        value: priority,
        label: formatLabel(priority),
      })),
    []
  );

  const [assigneeQuery, setAssigneeQuery] = useState("");

  const assigneeFilterOptions = useMemo(() => {
    const normalized = assigneeOptions.filter(
      (option) => option.value !== UNASSIGNED_FILTER_VALUE
    );

    return [
      { value: UNASSIGNED_FILTER_VALUE, label: "Unassigned" },
      ...normalized,
    ];
  }, [assigneeOptions]);

  const filteredAssignees = useMemo(() => {
    if (!assigneeQuery) return assigneeFilterOptions;

    const normalizedQuery = assigneeQuery.toLowerCase();
    return assigneeFilterOptions.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery)
    );
  }, [assigneeFilterOptions, assigneeQuery]);

  const appliedChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];

    filters.statuses.forEach((status) =>
      chips.push({
        label: `Status: ${formatLabel(status)}`,
        onRemove: () =>
          onFiltersChange({ ...filters, statuses: filters.statuses.filter((s) => s !== status) }),
      })
    );

    filters.assignees.forEach((assigneeId) => {
      const label =
        assigneeId === UNASSIGNED_FILTER_VALUE
          ? "Unassigned"
          : assigneeFilterOptions.find((option) => option.value === assigneeId)?.label ??
            "Assignee";

      chips.push({
        label: `Assignee: ${label}`,
        onRemove: () =>
          onFiltersChange({
            ...filters,
            assignees: filters.assignees.filter((a) => a !== assigneeId),
          }),
      });
    });

    filters.types.forEach((type) =>
      chips.push({
        label: `Type: ${formatLabel(type)}`,
        onRemove: () =>
          onFiltersChange({ ...filters, types: filters.types.filter((t) => t !== type) }),
      })
    );

    filters.priorities.forEach((priority) =>
      chips.push({
        label: `Priority: ${formatLabel(priority)}`,
        onRemove: () =>
          onFiltersChange({
            ...filters,
            priorities: filters.priorities.filter((p) => p !== priority),
          }),
      })
    );

    filters.epics.forEach((epicId) =>
      chips.push({
        label: `Epic: ${
          epicOptions.find((option) => option.value === epicId)?.label ?? "Epic"
        }`,
        onRemove: () =>
          onFiltersChange({
            ...filters,
            epics: filters.epics.filter((id) => id !== epicId),
          }),
      })
    );

    if (filters.search.trim()) {
      chips.push({
        label: `Search: "${filters.search}"`,
        onRemove: () => onFiltersChange({ ...filters, search: "" }),
      });
    }

    return chips;
  }, [assigneeFilterOptions, epicOptions, filters, onFiltersChange]);

  const handleCheckboxToggle = (
    key: keyof BacklogFilters,
    value: string
  ) => {
    const existing = filters[key] as string[];
    const nextValues = existing.includes(value)
      ? existing.filter((item) => item !== value)
      : [...existing, value];

    onFiltersChange({ ...filters, [key]: nextValues } as BacklogFilters);
  };

  const filterBadge = (values: unknown[]) =>
    values.length > 0 ? values.length.toString() : undefined;

  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => (Array.isArray(value) ? value.length > 0 : value)),
    [filters]
  );

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <FilterDropdown label="Status" badge={filterBadge(filters.statuses)}>
          <div className="space-y-2">
            {statusOptions.map((status) => (
              <label
                key={status.value}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{status.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={filters.statuses.includes(status.value)}
                  onChange={() => handleCheckboxToggle("statuses", status.value)}
                />
              </label>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown label="Assignee" badge={filterBadge(filters.assignees)}>
          <div className="space-y-2">
            <input
              type="text"
              value={assigneeQuery}
              onChange={(event) => setAssigneeQuery(event.target.value)}
              placeholder="Search members"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-700 shadow-inner focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {filteredAssignees.map((assignee) => (
                <label
                  key={assignee.value}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>{assignee.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={filters.assignees.includes(assignee.value)}
                    onChange={() => handleCheckboxToggle("assignees", assignee.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        </FilterDropdown>

        <FilterDropdown label="Type" badge={filterBadge(filters.types)}>
          <div className="space-y-2">
            {typeOptions.map((type) => (
              <label
                key={type.value}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{type.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={filters.types.includes(type.value)}
                  onChange={() => handleCheckboxToggle("types", type.value)}
                />
              </label>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown label="Priority" badge={filterBadge(filters.priorities)}>
          <div className="space-y-2">
            {priorityOptions.map((priority) => (
              <label
                key={priority.value}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span>{priority.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={filters.priorities.includes(priority.value)}
                  onChange={() => handleCheckboxToggle("priorities", priority.value)}
                />
              </label>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown label="Epic" badge={filterBadge(filters.epics)}>
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {epicOptions.length === 0 ? (
              <p className="px-2 py-1 text-sm text-slate-500">No epics yet</p>
            ) : (
              epicOptions.map((epic) => (
                <label
                  key={epic.value}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <span>{epic.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={filters.epics.includes(epic.value)}
                    onChange={() => handleCheckboxToggle("epics", epic.value)}
                  />
                </label>
              ))
            )}
          </div>
        </FilterDropdown>

        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <svg
            className="h-4 w-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.65 5.65a7.5 7.5 0 0011 11z"
            />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search issues"
            className="w-40 min-w-[160px] border-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none dark:text-slate-200"
          />
        </div>

        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:text-slate-200"
        >
          Clear all
        </button>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {appliedChips.map((chip) => (
            <span
              key={chip.label}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove ${chip.label}`}
                className="rounded-full p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden
                >
                  <path
                    d="M13 1L1 13M1 1l12 12"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const resetBacklogFilters = () => defaultBacklogFilters;
