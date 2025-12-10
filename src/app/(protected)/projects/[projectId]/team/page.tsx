import { notFound, redirect } from "next/navigation";

import { resolveProjectId, type ProjectParams } from "@/lib/params";

type Props = {
  params: ProjectParams;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProjectTeamPage(props: Props) {
  const params = await props.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    notFound();
  }

  redirect(`/projects/${projectId}/settings#team`);
}
