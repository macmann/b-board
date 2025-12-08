import { UserRole } from "../../../../../lib/prismaEnums";

import { getCurrentProjectContext } from "../../../../../lib/projectContext";
import { ProjectRole } from "../../../../../lib/roles";
import ProjectTeamPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function ProjectTeamPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { membership, user } = await getCurrentProjectContext(params.projectId);
  const projectRole = mapRole(membership?.role as ProjectRole | null, user?.role ?? null);

  return <ProjectTeamPageClient projectId={params.projectId} projectRole={projectRole} />;
}
