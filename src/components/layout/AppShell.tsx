import Link from "next/link";
import type { ReactNode } from "react";

import Button from "../ui/Button";

type AppShellProps = {
  children: ReactNode;
  currentProjectName?: string;
  user?: { name?: string | null; email?: string | null } | null;
  onLogout?: () => Promise<void> | void;
  currentPath?: string | null;
};

const navLinks = [
  { href: "/my-projects", label: "My Projects" },
  { href: "/import/jira", label: "Import from Jira" },
  { href: "/reports", label: "Reports" },
];

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

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white">
            BB
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">B Board</span>
            <span className="text-sm font-semibold text-slate-900">Workspace</span>
          </div>
        </div>

        <nav className="mt-4 space-y-1 px-3">
          {navLinks.map((link) => {
            const isActive = currentPath?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={classNames(
                  "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "-ml-1 border-l-2 border-primary bg-slate-100 pl-4 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-4 backdrop-blur">
          <div className="flex flex-col">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Current Project</span>
            <span className="text-lg font-semibold text-slate-900">{projectLabel}</span>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{user.name ?? "Admin"}</div>
                <div className="text-xs text-slate-500">{user.email ?? "admin@bboard.com"}</div>
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
