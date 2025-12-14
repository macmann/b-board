import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function LegacyJiraImportRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const projectId = typeof searchParams?.projectId === "string" ? searchParams.projectId : null;
  const target = projectId ? routes.project.settingsImport(projectId) : routes.myProjects();

  redirect(target);
}
