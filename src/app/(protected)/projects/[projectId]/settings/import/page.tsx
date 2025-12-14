import { notFound, redirect } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import JiraImportForm from "../JiraImportForm";

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

export default async function ProjectImportSettingsPage({ params }: Props) {
  const routeParams = await params;
  const projectId = await resolveProjectId(routeParams);

  if (!projectId) {
    notFound();
  }

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!project || !user) {
    notFound();
  }

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);
  const isAdmin = projectRole === "ADMIN" || projectRole === "PO";

  if (!isAdmin) {
    redirect(`/projects/${projectId}/settings`);
  }

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

      <ProjectTabs projectId={projectId} active="settings" />

      <JiraImportForm projectId={projectId} projectName={project.name} />
    </div>
  );
}
