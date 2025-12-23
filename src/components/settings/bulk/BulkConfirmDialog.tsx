"use client";

import type { BulkAction } from "@/app/(protected)/projects/[projectId]/settings/tabs/BulkOperationsTab";
import { Button } from "@/components/ui/Button";

export type BulkResult = {
  successCount: number;
  failureCount: number;
  failures: { issueId: string; key: string | null; reason: string }[];
} | null;

type BulkConfirmDialogProps = {
  issueCount: number;
  action: BulkAction | null;
  isExecuting: boolean;
  requireConfirmation?: boolean;
  confirmationChecked: boolean;
  onConfirmationChange: (checked: boolean) => void;
  onExecute: () => void;
  result: BulkResult;
};

export default function BulkConfirmDialog({
  issueCount,
  action,
  isExecuting,
  requireConfirmation,
  confirmationChecked,
  onConfirmationChange,
  onExecute,
  result,
}: BulkConfirmDialogProps) {
  const actionLabel = action?.type
    ? action.type.charAt(0) + action.type.slice(1).toLowerCase()
    : "Select an action";

  const requiresValue = action?.type && action.type !== "DELETE";
  const hasValue =
    !requiresValue || (action?.value !== undefined && action?.value !== "");

  const canExecute =
    Boolean(action) &&
    hasValue &&
    issueCount > 0 &&
    (!requireConfirmation || confirmationChecked) &&
    !isExecuting;

  return (
    <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
      <p>
        {issueCount === 0
          ? "No issues selected. Use filters to preview issues before executing a bulk action."
          : `About to apply ${actionLabel} to ${issueCount} issue${issueCount === 1 ? "" : "s"}.`}
      </p>

      {requireConfirmation && (
        <label className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400">
          <input
            type="checkbox"
            checked={confirmationChecked}
            onChange={(event) => onConfirmationChange(event.target.checked)}
            className="h-4 w-4"
          />
          I understand this action cannot be undone.
        </label>
      )}

      <Button onClick={onExecute} disabled={!canExecute}>
        {isExecuting ? "Applying..." : "Execute bulk operation"}
      </Button>

      {result && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <p className="font-semibold">Result</p>
          <p className="mt-1">{result.successCount} succeeded</p>
          <p>{result.failureCount} failed</p>
          {result.failures.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {result.failures.map((failure) => (
                <li key={failure.issueId}>
                  {failure.key ?? failure.issueId}: {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
