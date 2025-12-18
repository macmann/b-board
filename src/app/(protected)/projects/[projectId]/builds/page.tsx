import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { BuildEnvironment, BuildStatus, UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import BuildsPageClient from "./pageClient";

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

export default async function ProjectBuildsPage(props: Props) {
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

  const builds = await prisma.build.findMany({
    where: { projectId },
    orderBy: [
      { deployedAt: "desc" },
      { plannedAt: "desc" },
      { createdAt: "desc" },
    ],
    include: { issueLinks: { select: { issueId: true } } },
  });

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);
  const roleLabel = projectRole ?? "Member";

  return (
    <div className="space-y-4">
      <ProjectHeader
        projectName={project.name}
        projectKey={project.key ?? project.name}
        projectDescription={project.description}
        projectIconUrl={project.iconUrl}
        currentUserName={user.name}
        currentUserEmail={user.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="builds" />

      <BuildsPageClient
        projectId={projectId}
        projectRole={projectRole}
        builds={builds.map((build) => ({
          id: build.id,
          key: build.key,
          name: build.name ?? "",
          description: build.description ?? "",
          status: build.status as BuildStatus,
          environment: build.environment as BuildEnvironment,
          plannedAt: build.plannedAt ? build.plannedAt.toISOString() : null,
          deployedAt: build.deployedAt ? build.deployedAt.toISOString() : null,
          createdById: build.createdById,
          createdAt: build.createdAt.toISOString(),
          updatedAt: build.updatedAt.toISOString(),
          issueCount: build.issueLinks.length,
        }))}
        currentUserId={user.id}
      />
    </div>
  );
}
