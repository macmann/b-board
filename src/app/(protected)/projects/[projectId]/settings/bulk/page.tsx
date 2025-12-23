import { notFound, redirect } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import prisma from "@/lib/db";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import ProjectSettingsPageClient from "../pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type Props = {
  params: ProjectParams;
};

export default async function ProjectBulkOperationsPage({ params }: Props) {
  const routeParams = await params;
  const projectId = await resolveProjectId(routeParams);

  if (!projectId) {
    notFound();
  }

  const { membership, user, project } = await getCurrentProjectContext(projectId);

  if (!project || !user) {
    notFound();
  }

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);
  const isAdmin = projectRole === "ADMIN" || projectRole === "PO";

  if (!isAdmin) {
    redirect(`/projects/${projectId}/settings`);
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
      aiSettings: true,
      sprints: {
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      },
      epics: {
        select: {
          id: true,
          title: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!projectWithMeta) {
    notFound();
  }

  const roleLabel = projectRole ?? "Member";

  return (
    <div className="space-y-2">
      <ProjectHeader
        projectName={projectWithMeta.name}
        projectKey={projectWithMeta.key ?? projectWithMeta.name}
        projectDescription={projectWithMeta.description}
        projectIconUrl={projectWithMeta.iconUrl}
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
          iconUrl: projectWithMeta.iconUrl,
          enableResearchBoard: projectWithMeta.enableResearchBoard,
          createdAt: projectWithMeta.createdAt.toISOString(),
          updatedAt: projectWithMeta.updatedAt.toISOString(),
        }}
        aiSettings={{
          backlogGroomingEnabled:
            projectWithMeta.aiSettings?.backlogGroomingEnabled ?? false,
        }}
        members={projectWithMeta.members.map((member) => ({
          ...member,
          createdAt: member.createdAt?.toISOString(),
        }))}
        projectRole={projectRole}
        sprints={projectWithMeta.sprints}
        epics={projectWithMeta.epics}
        initialTab="bulk"
      />
    </div>
  );
}
