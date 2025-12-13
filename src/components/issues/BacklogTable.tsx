import { useMemo } from "react";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  IssuePriority,
  IssueStatus,
  IssueType,
} from "@/lib/prismaEnums";
import IssueTypeIcon from "./IssueTypeIcon";
import {
  InlineNumberCell,
  InlineSelectCell,
  InlineUserSelectCell,
  SelectOption,
} from "./InlineEditableCell";

export type BacklogTableIssue = {
  id: string;
  key?: string | null;
  title: string;
  sprintId?: string | null;
  position?: number | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  storyPoints?: number | null;
  assignee?: { id: string; name: string } | null;
  epic?: { id: string; title: string } | null;
};

type BacklogTableProps = {
  issues: BacklogTableIssue[];
  onIssueClick?: (issueId: string) => void;
  onIssueUpdate?: (
    issueId: string,
    updates: {
      type?: IssueType;
      status?: IssueStatus;
      priority?: IssuePriority;
      storyPoints?: number | null;
      assigneeId?: string | null;
      epicId?: string | null;
    }
  ) => Promise<boolean>;
  assigneeOptions: SelectOption[];
  epicOptions: SelectOption[];
  isReadOnly?: boolean;
  disableDrag?: boolean;
};

const columnWidths = [
  "w-10",
  "w-20",
  "w-[38%] min-w-[260px]",
  "w-24",
  "w-32",
  "w-28",
  "w-20",
  "w-40",
  "w-40",
];

const statusStyles: Record<IssueStatus, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  IN_REVIEW:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
};

const priorityStyles: Record<IssuePriority, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  MEDIUM:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  CRITICAL: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-100",
};

const formatLabel = (label: string) => label.replace(/_/g, " ");

function DragHandle({
  listeners,
  disabled,
}: {
  listeners?: Record<string, any>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`group flex items-center justify-center rounded-md border border-transparent p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:hover:bg-slate-800 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-grab"
      }`}
      aria-label="Drag to reorder"
      onClick={(event) => event.stopPropagation()}
      {...(disabled ? {} : listeners)}
    >
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden
      >
        <path d="M7 4a2 2 0 11-4 0 2 2 0 014 0zM17 4a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0zM17 10a2 2 0 11-4 0 2 2 0 014 0zM7 16a2 2 0 11-4 0 2 2 0 014 0zM17 16a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    </button>
  );
}

function SortableRow({
  issue,
  onIssueClick,
  onIssueUpdate,
  assigneeOptions,
  epicOptions,
  isReadOnly,
  disableDrag,
}: {
  issue: BacklogTableIssue;
  onIssueClick?: (issueId: string) => void;
  onIssueUpdate?: BacklogTableProps["onIssueUpdate"];
  assigneeOptions: SelectOption[];
  epicOptions: SelectOption[];
  isReadOnly?: boolean;
  disableDrag?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, disabled: disableDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const rowClasses = `border-b last:border-b-0 border-slate-100 dark:border-slate-800 ${
    onIssueClick ? "cursor-pointer" : ""
  } ${isDragging ? "bg-blue-50/60 dark:bg-slate-800" : ""}`;
  const cellBaseClasses = "px-4 py-3 text-sm text-slate-700 dark:text-slate-200";

  const typeOptions = useMemo(
    () =>
      Object.values(IssueType).map((type) => ({
        value: type,
        label: formatLabel(type),
      })),
    []
  );

  const statusOptions = useMemo(
    () =>
      Object.values(IssueStatus).map((status) => ({
        value: status,
        label: formatLabel(status),
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

  const assigneeLabel =
    assigneeOptions.find((option) => option.value === issue.assignee?.id)?.label ??
    issue.assignee?.name ??
    "Unassigned";

  const epicLabel =
    epicOptions.find((option) => option.value === issue.epic?.id)?.label ??
    issue.epic?.title ??
    "None";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={rowClasses}
      onClick={() => onIssueClick?.(issue.id)}
    >
      <td className={`${cellBaseClasses} ${columnWidths[0]} text-center`}>
        <DragHandle listeners={listeners} disabled={disableDrag} />
      </td>
      <td
        className={`${cellBaseClasses} ${columnWidths[1]} whitespace-nowrap font-medium text-slate-900 dark:text-slate-100`}
      >
        {issue.key ?? "—"}
      </td>
      <td
        className={`${cellBaseClasses} ${columnWidths[2]} truncate font-medium text-slate-900 dark:text-slate-100`}
        title={issue.title}
      >
        {issue.title}
      </td>
      <td className={`${cellBaseClasses} ${columnWidths[3]} whitespace-nowrap`}>
        <InlineSelectCell
          value={issue.type}
          labelRenderer={(value) => (
            <div className="inline-flex items-center gap-2">
              <IssueTypeIcon type={value} />
              <span className="capitalize">{formatLabel(value)}</span>
            </div>
          )}
          options={typeOptions}
          onSave={(next) =>
            onIssueUpdate ? onIssueUpdate(issue.id, { type: next }) : Promise.resolve(false)
          }
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellBaseClasses} ${columnWidths[4]}`}>
        <InlineSelectCell
          value={issue.status}
          labelRenderer={(value) => (
            <div className="flex justify-center">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[value]}`}
              >
                {formatLabel(value)}
              </span>
            </div>
          )}
          options={statusOptions}
          onSave={(next) =>
            onIssueUpdate ? onIssueUpdate(issue.id, { status: next }) : Promise.resolve(false)
          }
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellBaseClasses} ${columnWidths[5]}`}>
        <InlineSelectCell
          value={issue.priority}
          labelRenderer={(value) => (
            <div className="flex justify-center">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${priorityStyles[value]}`}
              >
                {formatLabel(value)}
              </span>
            </div>
          )}
          options={priorityOptions}
          onSave={(next) =>
            onIssueUpdate ? onIssueUpdate(issue.id, { priority: next }) : Promise.resolve(false)
          }
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellBaseClasses} ${columnWidths[6]} whitespace-nowrap text-center`}>
        <InlineNumberCell
          value={issue.storyPoints ?? null}
          placeholder="—"
          onSave={(next) =>
            onIssueUpdate
              ? onIssueUpdate(issue.id, { storyPoints: next })
              : Promise.resolve(false)
          }
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellBaseClasses} ${columnWidths[7]} truncate`} title={assigneeLabel}>
        <InlineUserSelectCell
          value={issue.assignee?.id ?? null}
          labelRenderer={(value) =>
            assigneeOptions.find((option) => option.value === value)?.label ??
            issue.assignee?.name ??
            "Unassigned"
          }
          options={assigneeOptions}
          onSave={(next) =>
            onIssueUpdate
              ? onIssueUpdate(issue.id, { assigneeId: next })
              : Promise.resolve(false)
          }
          disabled={isReadOnly}
        />
      </td>
      <td className={`${cellBaseClasses} ${columnWidths[8]} truncate`} title={epicLabel}>
        <InlineSelectCell
          value={issue.epic?.id ?? null}
          placeholder="None"
          labelRenderer={(value) =>
            value
              ? epicOptions.find((option) => option.value === value)?.label ?? ""
              : "None"
          }
          options={epicOptions}
          allowEmpty
          onSave={(next) =>
            onIssueUpdate
              ? onIssueUpdate(issue.id, { epicId: next })
              : Promise.resolve(false)
          }
          disabled={isReadOnly}
        />
      </td>
    </tr>
  );
}

export default function BacklogTable({
  issues,
  onIssueClick,
  onIssueUpdate,
  assigneeOptions,
  epicOptions,
  isReadOnly = false,
  disableDrag = false,
}: BacklogTableProps) {
  const hasIssues = issues.length > 0;

  if (!hasIssues) {
    return (
      <div className="overflow-hidden rounded-xl border border-dashed border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">
            No issues in this list yet
          </p>
          <p className="mt-2">Drag an issue here or create a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="table-fixed w-full">
        <colgroup>
          {columnWidths.map((width) => (
            <col key={width} className={width} />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70">
            <th className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[0]}`} />
            <th
              className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[1]} whitespace-nowrap`}
            >
              Key
            </th>
            <th
              className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[2]}`}
            >
              Title
            </th>
            <th
              className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[3]} whitespace-nowrap`}
            >
              Type
            </th>
            <th
              className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[4]}`}
            >
              Status
            </th>
            <th
              className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[5]}`}
            >
              Priority
            </th>
            <th
              className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[6]} whitespace-nowrap`}
            >
              Story Points
            </th>
            <th
              className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[7]}`}
            >
              Assignee
            </th>
            <th
              className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${columnWidths[8]}`}
            >
              Epic
            </th>
          </tr>
        </thead>
        <SortableContext
          items={issues.map((issue) => issue.id)}
          strategy={verticalListSortingStrategy}
        >
          <tbody>
            {issues.map((issue) => (
              <SortableRow
                key={issue.id}
                issue={issue}
                onIssueClick={onIssueClick}
                onIssueUpdate={onIssueUpdate}
                assigneeOptions={assigneeOptions}
                epicOptions={epicOptions}
                isReadOnly={isReadOnly}
                disableDrag={disableDrag}
              />
            ))}
          </tbody>
        </SortableContext>
      </table>
    </div>
  );
}
