"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ResearchStatus } from "@/lib/prismaEnums";

import { type SelectOption } from "@/components/issues/InlineEditableCell";
import {
  GENERAL_RESEARCH_TYPE_VALUE,
  type ResearchFilters,
  UNASSIGNED_FILTER_VALUE,
} from "./researchFilters";

type ResearchFilterBarProps = {
  filters: ResearchFilters;
  onFiltersChange: (next: ResearchFilters) => void;
  onClearFilters: () => void;
  assigneeOptions: SelectOption[];
  typeOptions: SelectOption[];
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

export default function ResearchFilterBar({
  filters,
  onFiltersChange,
  onClearFilters,
  assigneeOptions,
  typeOptions,
}: ResearchFilterBarProps) {
  const statusOptions = useMemo(
    () =>
      Object.values(ResearchStatus).map((status) => ({
        value: status,
        label: formatLabel(status),
      })),
    []
  );

  const [assigneeQuery, setAssigneeQuery] = useState("");

  const assigneeFilterOptions = useMemo(() => {
    const normalized = assigneeOptions.filter(
      (option) => option.value !== UNASSIGNED_FILTER_VALUE
    );

    return [{ value: UNASSIGNED_FILTER_VALUE, label: "Unassigned" }, ...normalized];
  }, [assigneeOptions]);

  const filteredAssignees = useMemo(() => {
    if (!assigneeQuery) return assigneeFilterOptions;

    const normalizedQuery = assigneeQuery.toLowerCase();
    return assigneeFilterOptions.filter((option) =>
      option.label.toLowerCase().includes(normalizedQuery)
    );
  }, [assigneeFilterOptions, assigneeQuery]);

  const normalizedTypeOptions = useMemo(
    () =>
      typeOptions.map((option) => ({
        value: option.value,
        label:
          option.value === GENERAL_RESEARCH_TYPE_VALUE ? "General" : option.label,
      })),
    [typeOptions]
  );

  const appliedChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];

    filters.statuses.forEach((status) =>
      chips.push({
        label: `Status: ${formatLabel(status)}`,
        onRemove: () =>
          onFiltersChange({
            ...filters,
            statuses: filters.statuses.filter((s) => s !== status),
          }),
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

    filters.types.forEach((type) => {
      const label =
        normalizedTypeOptions.find((option) => option.value === type)?.label ??
        "Type";

      chips.push({
        label: `Type: ${label}`,
        onRemove: () =>
          onFiltersChange({
            ...filters,
            types: filters.types.filter((t) => t !== type),
          }),
      });
    });

    if (filters.search.trim()) {
      chips.push({
        label: `Search: "${filters.search}"`,
        onRemove: () => onFiltersChange({ ...filters, search: "" }),
      });
    }

    return chips;
  }, [
    assigneeFilterOptions,
    filters,
    normalizedTypeOptions,
    onFiltersChange,
  ]);

  const handleCheckboxToggle = (
    key: keyof ResearchFilters,
    value: string
  ) => {
    const existing = filters[key] as string[];
    const nextValues = existing.includes(value)
      ? existing.filter((item) => item !== value)
      : [...existing, value];

    onFiltersChange({ ...filters, [key]: nextValues } as ResearchFilters);
  };

  const hasFilters = useMemo(
    () =>
      filters.statuses.length > 0 ||
      filters.assignees.length > 0 ||
      filters.types.length > 0 ||
      filters.search.trim().length > 0,
    [filters]
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center gap-2">
        <FilterDropdown
          label="Status"
          badge={filters.statuses.length ? `${filters.statuses.length}` : undefined}
        >
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <span>{option.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={filters.statuses.includes(option.value)}
                  onChange={() => handleCheckboxToggle("statuses", option.value)}
                />
              </label>
            ))}
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Assignee"
          badge={filters.assignees.length ? `${filters.assignees.length}` : undefined}
        >
          <div className="space-y-2">
            <input
              type="search"
              value={assigneeQuery}
              onChange={(event) => setAssigneeQuery(event.target.value)}
              placeholder="Filter assignees"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {filteredAssignees.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200"
                >
                  <span>{option.label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                    checked={filters.assignees.includes(option.value)}
                    onChange={() => handleCheckboxToggle("assignees", option.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        </FilterDropdown>

        <FilterDropdown
          label="Type"
          badge={filters.types.length ? `${filters.types.length}` : undefined}
        >
          <div className="space-y-2">
            {normalizedTypeOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200"
              >
                <span>{option.label}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  checked={filters.types.includes(option.value)}
                  onChange={() => handleCheckboxToggle("types", option.value)}
                />
              </label>
            ))}
          </div>
        </FilterDropdown>

        <div className="flex flex-1 items-center gap-2">
          <input
            type="search"
            value={filters.search}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value })
            }
            placeholder="Search research by key or title"
            className="w-full min-w-[200px] rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          />
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:text-slate-100"
          >
            Clear
          </button>
        </div>
      </div>

      {hasFilters && (
        <div className="flex flex-wrap gap-2">
          {appliedChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <span>{chip.label}</span>
              <svg
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  d="M9 3L3 9M3 3L9 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
