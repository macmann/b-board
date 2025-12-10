import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { notFound } from "next/navigation";

import { resolveProjectId, type ProjectParams } from "@/lib/params";
import ProjectTeamPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

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

  const { membership, user, project } = await getCurrentProjectContext(projectId);

  if (!project) {
    notFound();
  }

  const projectRole = mapRole(membership?.role as ProjectRole | null, user?.role ?? null);

  const roleLabel = projectRole ?? "Member";

  return (
    <div className="space-y-2">
      <ProjectHeader
        projectName={project.name}
        projectKey={project.key ?? project.name}
        projectDescription={project.description}
        currentUserName={user?.name}
        currentUserEmail={user?.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="team" />

      <ProjectTeamPageClient projectId={projectId} projectRole={projectRole} />
    </div>
  );
}
