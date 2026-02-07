import Link from "next/link";

type ProjectTabKey =
  | "backlog"
  | "board"
  | "builds"
  | "sprints"
  | "epics"
  | "reports"
  | "qa"
  | "standup"
  | "settings";

type ProjectTabsProps = {
  projectId: string;
  active: ProjectTabKey;
};

const tabs: { key: ProjectTabKey; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "board", label: "Board" },
  { key: "builds", label: "Builds" },
  { key: "sprints", label: "Sprints" },
  { key: "epics", label: "Epics" },
  { key: "reports", label: "Reports" },
  { key: "qa", label: "QA" },
  { key: "standup", label: "Standup" },
  { key: "settings", label: "Settings" },
];

export default function ProjectTabs({ projectId, active }: ProjectTabsProps) {
  return (
    <div className="mt-2 border-b border-slate-200 text-sm">
      <nav className="flex gap-6">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/projects/${projectId}/${tab.key}`}
              className={`border-b-2 border-transparent pb-2 text-slate-500 transition-colors hover:text-slate-900${
                isActive ? " border-primary font-medium text-primary" : ""
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
