import { IssuePriority, IssueStatus, IssueType } from "@/lib/prismaEnums";

export type BacklogTableIssue = {
  id: string;
  key?: string | null;
  title: string;
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
};

const statusStyles: Record<IssueStatus, string> = {
  TODO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  IN_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  DONE: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
};

const priorityStyles: Record<IssuePriority, string> = {
  HIGH: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  CRITICAL: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-100",
};

const formatLabel = (label: string) => label.replace(/_/g, " ");

export default function BacklogTable({ issues, onIssueClick }: BacklogTableProps) {
  const hasIssues = issues.length > 0;
  const rowBaseClasses =
    "transition hover:bg-slate-50 border-b last:border-b-0 border-slate-100 dark:border-slate-800 dark:hover:bg-slate-800";
  const cellBaseClasses = "px-6 py-3 text-sm text-slate-700 dark:text-slate-200";

  if (!hasIssues) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Backlog
        </div>
        <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">No issues in the backlog yet</p>
          <p className="mt-2">Click “Create Issue” to add your first item.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/70">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Key
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Priority
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Story Points
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Assignee
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Epic
            </th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const rowClasses = onIssueClick
              ? `${rowBaseClasses} cursor-pointer`
              : rowBaseClasses;

            return (
              <tr
                key={issue.id}
                className={rowClasses}
                onClick={() => onIssueClick?.(issue.id)}
              >
                <td className={`${cellBaseClasses} font-medium text-slate-900 dark:text-slate-100`}>{issue.key ?? "—"}</td>
                <td className={`${cellBaseClasses} font-medium text-slate-900 dark:text-slate-100`}>{issue.title}</td>
                <td className={cellBaseClasses}>{issue.type}</td>
                <td className={cellBaseClasses}>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[issue.status]}`}
                  >
                    {formatLabel(issue.status)}
                  </span>
                </td>
                <td className={cellBaseClasses}>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${priorityStyles[issue.priority]}`}
                  >
                    {formatLabel(issue.priority)}
                  </span>
                </td>
                <td className={cellBaseClasses}>
                  {issue.storyPoints === null || issue.storyPoints === undefined
                    ? "—"
                    : issue.storyPoints}
                </td>
                <td className={cellBaseClasses}>{issue.assignee?.name ?? "Unassigned"}</td>
                <td className={cellBaseClasses}>{issue.epic?.title ?? "None"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
