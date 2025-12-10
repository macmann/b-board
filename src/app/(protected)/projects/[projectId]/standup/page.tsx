import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import StandupPageClient from "./pageClient";

type Props = {
  params: ProjectParams;
  searchParams?: Record<string, string | string[] | undefined>;
};

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function ProjectStandupPage(props: Props) {
  const params = await props.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    notFound();
  }

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!project || !user) {
    notFound();
  }

  if (!membership && user.role !== UserRole.ADMIN) {
    notFound();
  }

  const projectRole = mapRole(
    (membership?.role as ProjectRole | null) ?? null,
    user.role ?? null
  );

  const roleLabel = projectRole ?? "Member";

  return (
    <div className="space-y-2">
      <ProjectHeader
        projectName={project.name}
        projectKey={project.key ?? project.name}
        projectDescription={project.description}
        currentUserName={user.name}
        currentUserEmail={user.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="standup" />

      <StandupPageClient
        projectId={projectId}
        projectRole={projectRole}
        currentUserName={user.name ?? ""}
        currentUserEmail={user.email ?? ""}
        projectName={project.name}
      />
    </div>
  );
}
