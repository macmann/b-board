import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import EpicsPageClient from "./pageClient";

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

export default async function ProjectEpicsPage(props: Props) {
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

  const projectWithMeta = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      key: true,
      description: true,
      iconUrl: true,
    },
  });

  if (!projectWithMeta) {
    notFound();
  }

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);
  const roleLabel = projectRole ?? "Member";
  const canManageEpics = projectRole === "ADMIN" || projectRole === "PO";

  return (
    <div className="space-y-4">
      <ProjectHeader
        projectName={projectWithMeta.name}
        projectKey={projectWithMeta.key ?? projectWithMeta.name}
        projectDescription={projectWithMeta.description}
        projectIconUrl={projectWithMeta.iconUrl}
        currentUserName={user.name}
        currentUserEmail={user.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="epics" />

      <EpicsPageClient projectId={projectId} canManageEpics={canManageEpics} />
    </div>
  );
}
