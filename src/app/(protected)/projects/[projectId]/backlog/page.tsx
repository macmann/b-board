import Link from "next/link";
import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import Button from "@/components/ui/Button";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { resolveProjectId, type ProjectParams } from "@/lib/params";

import BacklogPageClient from "./pageClient";

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

export default async function ProjectBacklogPage(props: Props) {
  const params = await props.params;
  const projectId = await resolveProjectId(params);

  console.log("[ProjectBacklogPage] resolved projectId:", projectId);

  if (!projectId) {
    notFound();
  }

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!project) {
    console.warn("[ProjectBacklogPage] Project not found for id", projectId);
    notFound();
  }

  const projectRole = mapRole(
    (membership?.role as ProjectRole | null) ?? null,
    user?.role ?? null
  );

  const roleLabel = projectRole ?? "Member";

  const manageTeamLink = (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Project: <span className="font-medium">{project.name}</span>
      </p>
      {projectRole && (projectRole === "ADMIN" || projectRole === "PO") && (
        <Button asChild>
          <Link href={`/projects/${projectId}/team`}>Manage Team</Link>
        </Button>
      )}
    </div>
  );

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

      <ProjectTabs projectId={projectId} active="backlog" />

      <BacklogPageClient
        projectId={projectId}
        projectRole={projectRole}
        manageTeamLink={manageTeamLink}
      />
    </div>
  );
}
