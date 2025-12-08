import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { notFound } from "next/navigation";
import ProjectSprintsPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type Props = {
  params: { projectId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProjectSprintsPage({ params }: Props) {
  const { projectId } = params;

  if (!projectId) {
    notFound();
  }

  const { membership, user, project } = await getCurrentProjectContext(projectId);

  if (!project) {
    notFound();
  }

  const projectRole = mapRole(membership?.role as ProjectRole | null, user?.role ?? null);

  return <ProjectSprintsPageClient projectId={projectId} projectRole={projectRole} />;
}
