import { ResearchStatus } from "@/lib/prismaEnums";

export type ResearchTableItem = {
  id: string;
  key: string;
  title: string;
  status: ResearchStatus;
  assignee?: { id: string; name: string } | null;
  researchType?: string | null;
  dueDate?: string | null;
  linkedIssuesCount: number;
  updatedAt: string;
};

type ResearchTableProps = {
  items: ResearchTableItem[];
  onRowClick?: (id: string) => void;
};

const statusStyles: Record<ResearchStatus, string> = {
  BACKLOG: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200",
  ARCHIVED: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

const formatDate = (value: string | Date | null | undefined) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatLabel = (label: string) => label.replace(/_/g, " ");

export default function ResearchTable({ items, onRowClick }: ResearchTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        No research items found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
            <th className="px-6 py-3">Key</th>
            <th className="px-6 py-3">Title</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Assignee</th>
            <th className="px-6 py-3">Research Type</th>
            <th className="px-6 py-3">Due Date</th>
            <th className="px-6 py-3">Linked Issues</th>
            <th className="px-6 py-3">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={`border-b last:border-b-0 border-slate-100 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60 ${onRowClick ? "cursor-pointer" : ""}`}
              onClick={() => onRowClick?.(item.id)}
            >
              <td className="px-6 py-3 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.key}
              </td>
              <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">{item.title}</td>
              <td className="px-6 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[item.status]}`}
                >
                  {formatLabel(item.status)}
                </span>
              </td>
              <td className="px-6 py-3">{item.assignee?.name ?? "Unassigned"}</td>
              <td className="px-6 py-3">{item.researchType ?? "—"}</td>
              <td className="px-6 py-3">{formatDate(item.dueDate)}</td>
              <td className="px-6 py-3">{item.linkedIssuesCount}</td>
              <td className="px-6 py-3">{formatDate(item.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
