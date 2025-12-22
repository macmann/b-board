import Link from "next/link";
import type { TestCase } from "@prisma/client";

import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TestCasePriority, TestCaseStatus, TestCaseType } from "@/lib/prismaEnums";

export type IssueSummary = { id: string; key: string | null; title: string | null };

export type TestCaseRow = TestCase & { story?: IssueSummary | null };

type TestCaseListProps = {
  testCases: TestCaseRow[];
  isLoading: boolean;
  error?: string;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (testCase: TestCaseRow) => void;
  onDelete: (testCase: TestCaseRow) => void;
  onInlineChange: (
    testCaseId: string,
    patch: Partial<Pick<TestCase, "status" | "priority">>
  ) => void;
  updatingId?: string | null;
  deletingId?: string | null;
};

const tableHeaderClass =
  "whitespace-nowrap px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const tableCellClass = "px-4 py-3 align-top text-sm text-slate-800 dark:text-slate-200";

const formatType = (type: TestCaseType) => {
  if (type === TestCaseType.POSITIVE) return "Positive";
  if (type === TestCaseType.NEGATIVE) return "Negative";
  return type;
};

export function TestCaseList({
  testCases,
  isLoading,
  error,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onInlineChange,
  updatingId,
  deletingId,
}: TestCaseListProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Loading test cases…</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>;
  }

  if (!testCases.length) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">No test cases yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            <th className={tableHeaderClass}>Story</th>
            <th className={tableHeaderClass}>TC Title</th>
            <th className={tableHeaderClass}>Pos/Neg</th>
            <th className={tableHeaderClass}>Test Data</th>
            <th className={tableHeaderClass}>Expected Result</th>
            <th className={tableHeaderClass}>Status</th>
            <th className={tableHeaderClass}>Priority</th>
            <th className={tableHeaderClass}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {testCases.map((testCase) => {
            const isBusy = updatingId === testCase.id || deletingId === testCase.id;
            const story = testCase.story;

            return (
              <tr key={testCase.id} className="bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800">
                <td className={tableCellClass}>
                  {story ? (
                    <div className="space-y-1">
                      <Link
                        href={`/issues/${story.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {story.key ?? "Story"}
                      </Link>
                      {story.title && (
                        <p className="text-xs text-slate-500 line-clamp-2">{story.title}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </td>
                <td className={`${tableCellClass} font-semibold`}>{testCase.title}</td>
                <td className={tableCellClass}>
                  <Badge variant="outline">{formatType(testCase.type)}</Badge>
                </td>
                <td className={tableCellClass}>
                  {testCase.testData ? (
                    <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                      {testCase.testData}
                    </p>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  {testCase.expectedResult ? (
                    <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                      {testCase.expectedResult}
                    </p>
                  ) : (
                    <span className="text-sm text-slate-500">—</span>
                  )}
                </td>
                <td className={tableCellClass}>
                  <select
                    value={testCase.status}
                    onChange={(event) =>
                      onInlineChange(testCase.id, {
                        status: event.target.value as TestCaseStatus,
                      })
                    }
                    disabled={!canEdit || isBusy}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {Object.values(TestCaseStatus).map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={tableCellClass}>
                  <select
                    value={testCase.priority}
                    onChange={(event) =>
                      onInlineChange(testCase.id, {
                        priority: event.target.value as TestCasePriority,
                      })
                    }
                    disabled={!canEdit || isBusy}
                    className="w-full rounded-md border border-slate-200 px-2 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {Object.values(TestCasePriority).map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </td>
                <td className={tableCellClass}>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onEdit(testCase)}
                      disabled={!canEdit || isBusy}
                    >
                      Edit
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-900/40"
                        onClick={() => onDelete(testCase)}
                        disabled={isBusy}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
