import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import prisma from "@/lib/db";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { notFound } from "next/navigation";

import ProjectSettingsPageClient from "./pageClient";

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

export default async function ProjectSettingsPage(props: Props) {
  const params = await props.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    notFound();
  }

  const { membership, user, project } = await getCurrentProjectContext(projectId);

  if (!project || !user) {
    notFound();
  }

  if (!membership && user.role !== UserRole.ADMIN) {
    notFound();
  }

  const projectWithMeta = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!projectWithMeta) {
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
        projectName={projectWithMeta.name}
        projectKey={projectWithMeta.key ?? projectWithMeta.name}
        projectDescription={projectWithMeta.description}
        currentUserName={user.name}
        currentUserEmail={user.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="settings" />

      <ProjectSettingsPageClient
        project={{
          id: projectWithMeta.id,
          key: projectWithMeta.key ?? "",
          name: projectWithMeta.name,
          description: projectWithMeta.description ?? "",
          enableResearchBoard: projectWithMeta.enableResearchBoard,
          createdAt: projectWithMeta.createdAt.toISOString(),
          updatedAt: projectWithMeta.updatedAt.toISOString(),
        }}
        members={projectWithMeta.members.map((member) => ({
          ...member,
          createdAt: member.createdAt?.toISOString(),
        }))}
        projectRole={projectRole}
      />
    </div>
  );
}
