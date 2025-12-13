import { redirect } from "next/navigation";

export default function LegacyJiraImportRedirect({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const projectId = typeof searchParams?.projectId === "string" ? searchParams.projectId : null;
  const target = projectId ? `/projects/${projectId}/settings/import` : "/my-projects";

  redirect(target);
}
