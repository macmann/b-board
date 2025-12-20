import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import QAPageClient from "./pageClient";

type Props = {
  params: ProjectParams;
};

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function ProjectQAPage({ params }: Props) {
  const resolvedParams = await params;
  const projectId = await resolveProjectId(resolvedParams);

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

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);
  const roleLabel = projectRole ?? "Member";

  return (
    <div className="space-y-2">
      <ProjectHeader
        projectName={project.name}
        projectKey={project.key ?? project.name}
        projectDescription={project.description}
        projectIconUrl={project.iconUrl}
        currentUserName={user.name}
        currentUserEmail={user.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="qa" />

      <QAPageClient projectId={projectId} projectRole={projectRole} />
    </div>
  );
}
