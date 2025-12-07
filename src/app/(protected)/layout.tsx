import Link from "next/link";
import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

import { getUserFromRequest } from "../../lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const headerList = headers();
  const cookieStore = cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const url = `${protocol}://${host}${headerList.get("x-invoke-path") ?? "/"}`;

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

    const currentHeaders = headers();
    const currentProtocol = currentHeaders.get("x-forwarded-proto") ?? "http";
    const currentHost = currentHeaders.get("host") ?? "localhost:3000";
    const cookieHeader = cookies()
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
    <div className="flex min-h-screen bg-gray-100 text-gray-900">
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-gray-200 px-6 py-4 text-lg font-semibold">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
            MJ
          </div>
          <span>Mini Jira</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm font-medium">
          <Link
            href="/projects"
            className="rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700"
          >
            Projects
          </Link>
          <Link
            href="/import"
            className="rounded-md px-3 py-2 text-gray-400 hover:bg-blue-50 hover:text-blue-700"
          >
            Import from Jira
          </Link>
          <span className="rounded-md px-3 py-2 text-gray-300">Reports</span>
        </nav>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex flex-col gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between gap-3 md:justify-start">
            <div className="md:hidden">
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">MJ</div>
                <span>Mini Jira</span>
              </Link>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Current project</p>
              <p className="text-lg font-semibold text-gray-900">{currentProjectName}</p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex flex-col text-sm">
              <span className="font-medium">{user.name ?? "User"}</span>
              <span className="text-gray-600">{user.email}</span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-red-200 transition hover:bg-red-100"
              >
                Logout
              </button>
            </form>
          </div>

          <div className="flex gap-2 md:hidden">
            <Link
              href="/projects"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700"
            >
              Projects
            </Link>
            <Link
              href="/import"
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-400 hover:bg-blue-50 hover:text-blue-700"
            >
              Import
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
