import { IssueType } from "@/lib/prismaEnums";

export const ISSUE_TYPE_METADATA: Record<IssueType, { icon: string; label: string }> = {
  [IssueType.STORY]: { icon: "📘", label: "Story" },
  [IssueType.BUG]: { icon: "🐛", label: "Bug" },
  [IssueType.TASK]: { icon: "🛠️", label: "Task" },
};

type IssueTypeIconProps = {
  type: IssueType;
  showLabel?: boolean;
};

export default function IssueTypeIcon({ type, showLabel = false }: IssueTypeIconProps) {
  const { icon, label } = ISSUE_TYPE_METADATA[type];

  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden>{icon}</span>
      {showLabel ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
