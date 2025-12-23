"use client";

import { useMemo } from "react";

import type {
  BulkAction,
  BulkActionType,
} from "@/app/(protected)/projects/[projectId]/settings/tabs/BulkOperationsTab";
import { IssuePriority, IssueStatus } from "@/lib/prismaEnums";

const ACTION_OPTIONS: { label: string; value: BulkActionType }[] = [
  { label: "Bulk Change Status", value: "STATUS" },
  { label: "Bulk Change Assignee", value: "ASSIGNEE" },
  { label: "Bulk Change Priority", value: "PRIORITY" },
  { label: "Bulk Move Sprint", value: "SPRINT" },
  { label: "Bulk Delete", value: "DELETE" },
];

type BulkActionSelectorProps = {
  action: BulkAction | null;
  onChange: (action: BulkAction | null) => void;
  statusOptions: IssueStatus[];
  priorityOptions: IssuePriority[];
  members: { id: string; label: string }[];
  sprints: { id: string; label: string }[];
};

export default function BulkActionSelector({
  action,
  onChange,
  statusOptions,
  priorityOptions,
  members,
  sprints,
}: BulkActionSelectorProps) {
  const selectedType = action?.type ?? "";

  const renderValueInput = useMemo(() => {
    switch (selectedType) {
      case "STATUS":
        return (
          <select
            value={(action?.value as IssueStatus | undefined) ?? ""}
            onChange={(event) => onChange({ type: "STATUS", value: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Select status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        );
      case "ASSIGNEE":
        return (
          <select
            value={(action?.value as string | null | undefined) ?? ""}
            onChange={(event) => onChange({ type: "ASSIGNEE", value: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Select assignee</option>
            <option value="UNASSIGNED">Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.label}
              </option>
            ))}
          </select>
        );
      case "PRIORITY":
        return (
          <select
            value={(action?.value as IssuePriority | undefined) ?? ""}
            onChange={(event) => onChange({ type: "PRIORITY", value: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Select priority</option>
            {priorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        );
      case "SPRINT":
        return (
          <select
            value={(action?.value as string | undefined) ?? ""}
            onChange={(event) => onChange({ type: "SPRINT", value: event.target.value })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Select sprint</option>
            <option value="BACKLOG">Backlog</option>
            {sprints.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.label}
              </option>
            ))}
          </select>
        );
      case "DELETE":
        return (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Issues will be permanently removed from this project.
          </p>
        );
      default:
        return null;
    }
  }, [action?.value, members, priorityOptions, selectedType, sprints, statusOptions]);

  const handleTypeChange = (nextType: string) => {
    if (!nextType) {
      onChange(null);
      return;
    }

    const type = nextType as BulkActionType;
    const defaultValue =
      type === "STATUS"
        ? statusOptions[0] ?? ""
        : type === "ASSIGNEE"
          ? ""
          : type === "PRIORITY"
            ? priorityOptions[0] ?? ""
            : type === "SPRINT"
              ? ""
              : null;

    onChange({ type, value: defaultValue ?? "" });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Operation
        </label>
        <select
          value={selectedType}
          onChange={(event) => handleTypeChange(event.target.value)}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Select an action</option>
          {ACTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {renderValueInput && (
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            New value
          </label>
          {renderValueInput}
        </div>
      )}
    </div>
  );
}
