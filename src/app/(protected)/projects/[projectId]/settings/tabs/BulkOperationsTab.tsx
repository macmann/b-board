"use client";

import { useCallback, useMemo, useState } from "react";

import BulkActionSelector from "@/components/settings/bulk/BulkActionSelector";
import BulkConfirmDialog from "@/components/settings/bulk/BulkConfirmDialog";
import BulkFilterForm from "@/components/settings/bulk/BulkFilterForm";
import BulkPreviewTable from "@/components/settings/bulk/BulkPreviewTable";
import type { BulkResult } from "@/components/settings/bulk/BulkConfirmDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  IssuePriority,
  IssueStatus,
  IssueType,
  Role,
} from "@/lib/prismaEnums";

export type BulkActionType =
  | "STATUS"
  | "ASSIGNEE"
  | "PRIORITY"
  | "SPRINT"
  | "DELETE";

export type BulkAction = {
  type: BulkActionType;
  value?: string | null;
};

export type BulkFilterState = {
  statuses: IssueStatus[];
  type?: IssueType | "";
  priority?: IssuePriority | "";
  assigneeId?: string | "";
  sprintId?: string | "" | "BACKLOG" | null;
  epicId?: string | "";
  search?: string;
};

export type BulkIssuePreview = {
  id: string;
  key: string | null;
  title: string;
  status: IssueStatus;
  assigneeName: string;
  sprintName: string;
};

const EMPTY_FILTER: BulkFilterState = {
  statuses: [],
  type: "",
  priority: "",
  assigneeId: "",
  sprintId: "",
  epicId: "",
  search: "",
};

const formatAssignee = (member: {
  user: { name: string | null; email: string | null };
}) => member.user.name ?? member.user.email ?? "Unassigned";

type BulkOperationsTabProps = {
  projectId: string;
  members: {
    id: string;
    role: Role;
    user: { id: string; name: string | null; email: string | null };
  }[];
  sprints: { id: string; name: string; status: string }[];
  epics: { id: string; title: string; status: string }[];
};

export default function BulkOperationsTab({
  projectId,
  members,
  sprints,
  epics,
}: BulkOperationsTabProps) {
  const [filter, setFilter] = useState<BulkFilterState>(EMPTY_FILTER);
  const [previewIssues, setPreviewIssues] = useState<BulkIssuePreview[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [action, setAction] = useState<BulkAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkResult>(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);

  const statusOptions = useMemo(() => Object.values(IssueStatus), []);
  const typeOptions = useMemo(() => Object.values(IssueType), []);
  const priorityOptions = useMemo(() => Object.values(IssuePriority), []);

  const assigneeOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        label: formatAssignee(member),
      })),
    [members]
  );

  const sprintOptions = useMemo(
    () => sprints.map((sprint) => ({ id: sprint.id, label: sprint.name })),
    [sprints]
  );

  const epicOptions = useMemo(
    () => epics.map((epic) => ({ id: epic.id, label: epic.title })),
    [epics]
  );

  const sanitizeFilter = useCallback(() => {
    const trimmedSearch = filter.search?.trim() ?? "";
    return {
      statuses: filter.statuses,
      type: filter.type || undefined,
      priority: filter.priority || undefined,
      assigneeId: filter.assigneeId || undefined,
      sprintId:
        filter.sprintId === "BACKLOG"
          ? null
          : filter.sprintId || undefined,
      epicId: filter.epicId || undefined,
      search: trimmedSearch || undefined,
    };
  }, [filter]);

  const fetchPreview = useCallback(async () => {
    setIsPreviewing(true);
    setError(null);
    setResult(null);
    setConfirmationChecked(false);

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: sanitizeFilter(),
          previewOnly: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Unable to preview issues.");
      }

      const data = await response.json();
      setPreviewIssues(data.issues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preview.");
      setPreviewIssues([]);
    } finally {
      setIsPreviewing(false);
    }
  }, [projectId, sanitizeFilter]);

  const executeAction = useCallback(async () => {
    if (!action) {
      setError("Please select a bulk action to perform.");
      return;
    }

    if (previewIssues.length === 0) {
      setError("Run a preview to select matching issues before applying actions.");
      return;
    }

    setIsExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter: sanitizeFilter(),
          action,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? "Bulk operation failed.");
      }

      setResult({
        successCount: data.successCount ?? 0,
        failureCount: data.failureCount ?? 0,
        failures: data.failures ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk operation failed.");
    } finally {
      setIsExecuting(false);
      setConfirmationChecked(false);
    }
  }, [action, previewIssues.length, projectId, sanitizeFilter]);

  const resetFilters = () => {
    setFilter(EMPTY_FILTER);
    setPreviewIssues([]);
    setResult(null);
    setAction(null);
    setError(null);
    setConfirmationChecked(false);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Bulk Operations
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Filter issues, preview matches, and apply updates in bulk.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                  Step 1 · Filters
                </h3>
                {error && (
                  <span className="text-xs text-red-500" role="alert">
                    {error}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <BulkFilterForm
                filter={filter}
                onFilterChange={(updated) => setFilter((prev) => ({ ...prev, ...updated }))}
                onSubmit={fetchPreview}
                statusOptions={statusOptions}
                typeOptions={typeOptions}
                priorityOptions={priorityOptions}
                members={assigneeOptions}
                sprints={sprintOptions}
                epics={epicOptions}
                isLoading={isPreviewing}
              />
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Step 2 · Preview ({previewIssues.length})
              </h3>
            </CardHeader>
            <CardContent>
              <BulkPreviewTable issues={previewIssues} isLoading={isPreviewing} />
            </CardContent>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="h-full">
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Step 3 · Choose Action
              </h3>
            </CardHeader>
            <CardContent>
              <BulkActionSelector
                action={action}
                onChange={(nextAction) => {
                  setAction(nextAction);
                  setConfirmationChecked(false);
                  setResult(null);
                }}
                statusOptions={statusOptions}
                priorityOptions={priorityOptions}
                members={assigneeOptions}
                sprints={sprintOptions}
              />
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                Step 4 · Confirm & Execute
              </h3>
            </CardHeader>
            <CardContent>
              <BulkConfirmDialog
                issueCount={previewIssues.length}
                action={action}
                isExecuting={isExecuting}
                requireConfirmation={action?.type === "DELETE"}
                confirmationChecked={confirmationChecked}
                onConfirmationChange={setConfirmationChecked}
                onExecute={executeAction}
                result={result}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
