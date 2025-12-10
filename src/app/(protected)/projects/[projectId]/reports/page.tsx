import { notFound } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import ProjectReportsPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type ServerProps = {
  params: { projectId: string } | Promise<{ projectId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function Page(props: ServerProps) {
  const resolvedParams = await props.params;
  const projectId = resolvedParams?.projectId;

  console.log("[ProjectPage] projectId:", projectId);

  if (!projectId) return notFound();

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!project) return notFound();

  mapRole((membership?.role as ProjectRole | null) ?? null, user?.role ?? null);

  return <ProjectReportsPageClient projectId={projectId} />;
}
