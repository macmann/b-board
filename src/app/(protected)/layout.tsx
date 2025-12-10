import "@/app/globals.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { getUserFromRequest } from "../../lib/auth";

type Props = {
  children: ReactNode;
};

export default async function ProtectedLayout({ children }: Props) {
  const headerList = await headers();
  const cookieStore = await cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const url = `${protocol}://${host}/`;

  const request = new NextRequest(url, {
    headers: new Headers(headerList),
  });

  cookieStore.getAll().forEach((cookie) => {
    request.cookies.set(cookie.name, cookie.value);
  });

  const user = await getUserFromRequest(request);

  if (!user) {
    redirect("/login");
  }

  const currentProjectName =
    headerList.get("x-current-project-name") ?? "Select a project";

  const logout = async () => {
    "use server";

    const currentHeaders = await headers();
    const currentProtocol = currentHeaders.get("x-forwarded-proto") ?? "http";
    const currentHost = currentHeaders.get("host") ?? "localhost:3000";
    const cookieHeader = (await cookies())
      .getAll()
      .map(({ name, value }) => `${name}=${value}`)
      .join("; ");

    await fetch(`${currentProtocol}://${currentHost}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
    });

    redirect("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex h-screen max-h-screen">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 border-r border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              BB
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                B Board
              </span>
              <span className="text-sm font-semibold text-slate-900">Workspace</span>
            </div>
          </div>

          <nav className="mt-4 space-y-1 px-3 text-sm">
            <Link
              href="/my-projects"
              className="flex items-center rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              My Projects
            </Link>
            <Link
              href="/import/jira"
              className="flex items-center rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              Import from Jira
            </Link>
            <Link
              href="/reports"
              className="flex items-center rounded-md px-3 py-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            >
              Reports
            </Link>
          </nav>
        </aside>

        {/* Main area */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current Project
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {currentProjectName}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {user && (
                <div className="text-right">
                  <div className="font-semibold">{user.name ?? "Admin"}</div>
                  <div className="text-xs text-slate-500">{user.email ?? "admin@bboard.com"}</div>
                </div>
              )}
              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Logout
                </button>
              </form>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
