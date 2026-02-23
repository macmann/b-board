import Link from "next/link";
import type { ReactNode } from "react";

import { Role } from "@/lib/prismaEnums";
import { routes } from "@/lib/routes";

import { Button } from "../ui/Button";
import ThemeToggle from "../theme/ThemeToggle";
import Logo from "../branding/Logo";
import ProjectSwitcher from "./ProjectSwitcher";
import NotificationBell from "./NotificationBell";

type AppShellProps = {
  children: ReactNode;
  currentProjectName?: string;
  user?: { name?: string | null; email?: string | null; role?: Role | null } | null;
  onLogout?: () => Promise<void> | void;
  currentPath?: string | null;
  hasLeadershipAccess?: boolean;
};

const classNames = (...classes: Array<string | null | false | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function AppShell({
  children,
  currentProjectName,
  user,
  onLogout,
  currentPath,
  hasLeadershipAccess,
}: AppShellProps) {
  const normalizedPath = currentPath?.split("?")[0] ?? "";
  const projectMatch = normalizedPath.match(/^\/projects\/([^/]+)/);
  const currentProjectId = projectMatch?.[1];
  const inProjectContext = Boolean(currentProjectId);
  const trimmedProjectName = currentProjectName?.trim();
  const projectLabel =
    trimmedProjectName && trimmedProjectName.length > 0
      ? trimmedProjectName
      : inProjectContext
        ? "Project overview"
        : "Select a project";
  const dashboardPath = routes.dashboard();
  const reportsPath = routes.reports();
  const showProjectSwitcher = normalizedPath.startsWith(dashboardPath) || normalizedPath.startsWith(reportsPath);

  const isLeadership =
    hasLeadershipAccess ?? (user?.role === Role.ADMIN || user?.role === Role.PO);

  const workspaceLinks = [
    { href: dashboardPath, label: "Dashboard", restricted: true },
    { href: routes.myProjects(), label: "My Projects", restricted: false },
    { href: reportsPath, label: "Reports", restricted: true },
  ].filter((link) => !link.restricted || isLeadership);

  const projectLinks = currentProjectId
    ? [
        { href: routes.project.backlog(currentProjectId), label: "Backlog" },
        { href: routes.project.board(currentProjectId), label: "Board" },
        { href: routes.project.builds(currentProjectId), label: "Builds" },
        { href: routes.project.sprints(currentProjectId), label: "Sprints" },
        { href: routes.project.epics(currentProjectId), label: "Epics" },
        { href: routes.project.reports(currentProjectId), label: "Reports" },
        { href: routes.project.qa(currentProjectId), label: "QA" },
        { href: routes.project.standup(currentProjectId), label: "Standup" },
        { href: routes.project.executionAlerts(currentProjectId), label: "Execution Alerts" },
        { href: routes.project.settings(currentProjectId), label: "Settings" },
      ]
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <input
        id="workspace-nav-toggle"
        type="checkbox"
        defaultChecked
        className="peer sr-only"
        aria-label="Toggle workspace navigation"
      />

      <aside className="flex w-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 peer-checked:w-64 dark:border-slate-800 dark:bg-slate-950">
        <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <Logo
              subtitle="Workspace"
              textClassName="gap-0.5"
              titleClassName="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400"
              subtitleClassName="text-sm font-semibold text-slate-900 dark:text-slate-50"
            />
            <label
              htmlFor="workspace-nav-toggle"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
              aria-label="Hide workspace navigation"
              title="Hide workspace navigation"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </label>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="px-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace</p>
          <nav className="space-y-1 px-3">
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
        </div>

        {inProjectContext && projectLinks.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="px-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Project
            </p>
            <nav className="mt-2 space-y-1 px-3">
              {projectLinks.map((link) => {
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
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex min-w-0 items-center gap-3">
            <label
              htmlFor="workspace-nav-toggle"
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
              aria-label="Toggle workspace navigation"
              title="Toggle workspace navigation"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </label>

            {showProjectSwitcher ? (
              <ProjectSwitcher currentProjectId={currentProjectId} />
            ) : (
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {inProjectContext ? "Current Project" : "Workspace"}
                </span>
                <span className="truncate text-lg font-semibold text-slate-900 dark:text-slate-50">{projectLabel}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            {user && (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{user.name ?? "Admin"}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{user.email ?? "admin@bboard.com"}</div>
              </div>
            )}
            {user && (
              <Button asChild aria-label="Profile settings" size="sm" variant="secondary">
                <Link href={routes.profile()}>
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 9.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Z" />
                    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2.2 2.2 0 1 1-3.1 3.1l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2.2 2.2 0 0 1-4.4 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2.2 2.2 0 1 1-3.1-3.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2.2 2.2 0 0 1 0-4.4h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2.2 2.2 0 1 1 3.1-3.1l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2.2 2.2 0 1 1 4.4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2.2 2.2 0 1 1 3.1 3.1l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2.2 2.2 0 0 1 0 4.4h-.1a1 1 0 0 0-.9.6Z" />
                  </svg>
                </Link>
              </Button>
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

        <main className="flex-1 overflow-y-auto px-8 pb-6 pt-0">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
