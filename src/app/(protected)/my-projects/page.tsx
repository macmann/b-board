import Link from "next/link";
import { cookies, headers } from "next/headers";

import { ProjectRole } from "../../../lib/roles";
import { MyProjectsTable } from "./MyProjectsTable";

type MyProject = {
  id: string;
  key: string;
  name: string;
  description?: string;
  role: ProjectRole;
};

async function fetchMyProjects(): Promise<MyProject[]> {
  const headerList = await headers();
  const cookieStore = await cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const response = await fetch(`${protocol}://${host}/api/my-projects`, {
    headers: {
      Cookie: cookieHeader,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  return response.json();
}

export default async function MyProjectsPage() {
  const projects = await fetchMyProjects();

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">My Projects</h1>
            <p className="text-gray-600">Projects you are a member of.</p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-md bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 transition hover:bg-blue-100"
          >
            Create or manage projects
          </Link>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Project List</h2>
          <MyProjectsTable projects={projects} />
        </section>
      </div>
    </main>
  );
}
