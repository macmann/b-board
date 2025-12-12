import { cookies, headers } from "next/headers";

import CreateProjectTrigger from "./CreateProjectTrigger";
import { MyProjectsTable, type ProjectSummary } from "./MyProjectsTable";

async function fetchMyProjects(): Promise<ProjectSummary[]> {
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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">My Projects</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your active projects and recent activity
            </p>
          </div>
          <CreateProjectTrigger />
        </header>

        <MyProjectsTable projects={projects} createAction={<CreateProjectTrigger />} />
      </div>
    </main>
  );
}
