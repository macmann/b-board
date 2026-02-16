import { notFound } from "next/navigation";

import ExecutionAlertsPageClient from "@/components/notifications/ExecutionAlertsPageClient";
import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { type ProjectRole } from "@/lib/roles";

type Props = {
  params: ProjectParams;
};

const mapRole = (membershipRole: ProjectRole | null, userRole: UserRole | null): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function ProjectExecutionAlertsPage(props: Props) {
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

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);

  return (
    <div className="space-y-2">
      <ProjectHeader
        projectName={project.name}
        projectKey={project.key ?? project.name}
        projectDescription={project.description}
        projectIconUrl={project.iconUrl}
        currentUserName={user.name}
        currentUserEmail={user.email}
        roleLabel={projectRole ?? "Member"}
      />
      <ProjectTabs projectId={projectId} active="execution-alerts" />
      <ExecutionAlertsPageClient projectId={projectId} />
    </div>
  );
}
