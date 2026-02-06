import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { getCurrentProjectContext } from "@/lib/projectContext";
import {
  BuildEnvironment,
  BuildStatus,
  IssueType,
  IssueStatus,
  UserRole,
} from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

import BuildDetailsPageClient from "./pageClient";

type Props = {
  params: ProjectParams & { buildId: string };
};

type LinkedIssue = {
  id: string;
  key: string | null;
  title: string;
  type: IssueType;
  status: IssueStatus;
  sprintName: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  createdAt: string;
};

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function BuildDetailsPage({ params }: Props) {
  const resolvedParams = await params;
  const projectId = await resolveProjectId(resolvedParams);
  const buildId = resolvedParams?.buildId;

  if (!projectId || !buildId) {
    notFound();
  }

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!project || !user) {
    notFound();
  }

  if (!membership && user.role !== UserRole.ADMIN) {
    notFound();
  }

  const build = await prisma.build.findFirst({
    where: { id: buildId, projectId },
    include: {
      issueLinks: {
        include: {
          issue: {
            include: {
              sprint: true,
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!build) {
    notFound();
  }

  const linkedIssues: LinkedIssue[] = build.issueLinks
    .map((link) => link.issue)
    .filter((issue): issue is NonNullable<typeof issue> => Boolean(issue))
    .map((issue) => ({
      id: issue.id,
      key: issue.key,
      title: issue.title,
      status: issue.status as IssueStatus,
      type: issue.type as IssueType,
      sprintName: issue.sprint?.name ?? null,
      assigneeName: issue.assignee?.name ?? null,
      assigneeId: issue.assignee?.id ?? null,
      createdAt: issue.createdAt.toISOString(),
    }));

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

      <BuildDetailsPageClient
        projectId={projectId}
        buildId={build.id}
        projectRole={projectRole}
        build={{
          id: build.id,
          key: build.key,
          name: build.name ?? "",
          description: build.description ?? "",
          status: build.status as BuildStatus,
          environment: build.environment as BuildEnvironment,
          plannedAt: build.plannedAt ? build.plannedAt.toISOString() : null,
          deployedAt: build.deployedAt ? build.deployedAt.toISOString() : null,
          createdAt: build.createdAt.toISOString(),
          updatedAt: build.updatedAt.toISOString(),
        }}
        linkedIssues={linkedIssues}
      />
    </div>
  );
}
