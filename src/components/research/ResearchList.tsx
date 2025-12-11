import ResearchTable, { type ResearchTableItem } from "./ResearchTable";
import { type ResearchBacklogItem } from "./types";

type ResearchListProps = {
  items: ResearchBacklogItem[];
  onOpenDetails?: (id: string) => void;
};

export default function ResearchList({ items, onOpenDetails }: ResearchListProps) {
  const tableItems: ResearchTableItem[] = items.map((item) => ({
    id: item.id,
    key: item.key,
    title: item.title,
    status: item.status,
    researchType: item.researchType ?? null,
    assignee: item.assignee ?? null,
    dueDate: item.dueDate
      ? new Date(item.dueDate).toISOString()
      : null,
    linkedIssuesCount: item.linkedIssuesCount ?? 0,
    updatedAt:
      typeof item.updatedAt === "string"
        ? item.updatedAt
        : item.updatedAt.toISOString(),
  }));

  return <ResearchTable items={tableItems} onRowClick={onOpenDetails} />;
}
