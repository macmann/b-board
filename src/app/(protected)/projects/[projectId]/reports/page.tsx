import { getCurrentProjectContext } from "@/lib/projectContext";
import { notFound } from "next/navigation";

import ProjectReportsPageClient from "./pageClient";

type Props = {
  params: { projectId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProjectReportsPage({ params }: Props) {
  const { projectId } = params;

  if (!projectId) {
    notFound();
  }

  const { project } = await getCurrentProjectContext(projectId);

  if (!project) {
    notFound();
  }

  return <ProjectReportsPageClient projectId={projectId} />;
}
