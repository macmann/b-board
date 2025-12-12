import Link from "next/link";
import type { ReactNode } from "react";

import Button from "../ui/Button";
import ThemeToggle from "../theme/ThemeToggle";

type AppShellProps = {
  children: ReactNode;
  currentProjectName?: string;
  user?: { name?: string | null; email?: string | null } | null;
  onLogout?: () => Promise<void> | void;
  currentPath?: string | null;
};

const classNames = (...classes: Array<string | null | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function AppShell({
  children,
  currentProjectName,
  user,
  onLogout,
  currentPath,
}: AppShellProps) {
  const projectLabel = currentProjectName && currentProjectName.length > 0 ? currentProjectName : "Select a project";
  const normalizedPath = currentPath?.split("?")[0] ?? "";
  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectMatch?.[1];

  const workspaceLinks = [
    { href: "/my-projects", label: "My Projects" },
    { href: "/reports", label: "Reports" },
  ];

  const projectLinks = currentProjectId
    ? [
        {
          href: `/projects/${currentProjectId}/backlog`,
          label: "Backlog",
          match: (path: string, fullPath: string) =>
            path.startsWith(`/projects/${currentProjectId}/backlog`) && !fullPath.includes("view=research"),
        },
        {
          href: `/projects/${currentProjectId}/backlog?view=research`,
          label: "Research",
          match: (_path: string, fullPath: string) =>
            fullPath.startsWith(`/projects/${currentProjectId}/backlog`) && fullPath.includes("view=research"),
        },
        { href: `/projects/${currentProjectId}/board`, label: "Board" },
        { href: `/projects/${currentProjectId}/standup`, label: "Standup" },
        { href: `/projects/${currentProjectId}/reports`, label: "Reports" },
        { href: `/projects/${currentProjectId}/settings`, label: "Settings" },
      ]
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
            BB
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">B Board</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Workspace</span>
          </div>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {workspaceLinks.map((link) => {
            const isActive = normalizedPath.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={classNames(
                  "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "-ml-1 border-l-2 border-primary bg-slate-100 pl-4 text-slate-900 dark:border-primary/80 dark:bg-slate-900 dark:text-slate-50"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {projectLinks.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="px-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Project
            </p>
            <nav className="mt-2 space-y-1 px-3">
              {projectLinks.map((link) => {
                const isActive = link.match
                  ? link.match(normalizedPath, currentPath ?? "")
                  : normalizedPath.startsWith(link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={classNames(
                      "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "-ml-1 border-l-2 border-primary bg-slate-100 pl-4 text-slate-900 dark:border-primary/80 dark:bg-slate-900 dark:text-slate-50"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Current Project</span>
            <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">{projectLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user && (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{user.name ?? "Admin"}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{user.email ?? "admin@bboard.com"}</div>
              </div>
            )}
            {onLogout && (
              <form action={onLogout} className="shrink-0">
                <Button variant="secondary" type="submit">
                  Logout
                </Button>
              </form>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
