import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
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

  const projectRole = mapRole(
    (membership?.role as ProjectRole | null) ?? null,
    user?.role ?? null
  );

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

      <ProjectTabs projectId={projectId} active="reports" />

      <ProjectReportsPageClient projectId={projectId} />
    </div>
  );
}
