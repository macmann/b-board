import type { BulkIssuePreview } from "@/app/(protected)/projects/[projectId]/settings/tabs/BulkOperationsTab";

import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type BulkPreviewTableProps = {
  issues: BulkIssuePreview[];
  isLoading?: boolean;
};

export default function BulkPreviewTable({ issues, isLoading }: BulkPreviewTableProps) {
  if (isLoading) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading preview...</p>;
  }

  if (!issues || issues.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Apply filters to see matching issues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-800/50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Key</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Title</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Status</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Assignee</th>
            <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">Sprint</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {issues.map((issue) => (
            <tr key={issue.id} className="bg-white dark:bg-slate-900">
              <td className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {issue.key ?? ""}
              </td>
              <td className="px-4 py-2 text-sm text-slate-800 dark:text-slate-100">{issue.title}</td>
              <td className="px-4 py-2">
                <Badge>{issue.status.replace(/_/g, " ")}</Badge>
              </td>
              <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                {issue.assigneeName || "Unassigned"}
              </td>
              <td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">
                {issue.sprintName || "Backlog"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
