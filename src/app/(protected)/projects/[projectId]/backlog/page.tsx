import Link from "next/link";
import { notFound } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import Button from "@/components/ui/Button";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { ResearchStatus, UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import prisma from "@/lib/db";

import BacklogPageClient, { BacklogGroup } from "./pageClient";
import { type ResearchBacklogItem } from "@/components/research/types";

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
  const activeSegment = props.searchParams?.view === "research" ? "research" : "product";

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

  const [backlogProject, projectMembers, epics] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sprints: {
          orderBy: { createdAt: "asc" },
        },
        issues: {
          orderBy: [
            { position: "asc" },
            { createdAt: "asc" },
          ],
          include: {
            sprint: true,
            assignee: true,
            epic: true,
          },
        },
      },
    }),
    prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.epic.findMany({
      where: { projectId },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const researchItems: ResearchBacklogItem[] = project.enableResearchBoard
    ? (
        await prisma.researchItem.findMany({
          where: { projectId, status: { not: ResearchStatus.ARCHIVED } },
          orderBy: [
            { status: "asc" },
            { position: "asc" },
            { createdAt: "asc" },
          ],
          include: {
            assignee: { select: { id: true, name: true } },
            issueLinks: {
              include: {
                issue: {
                  select: { assignee: { select: { id: true, name: true } } },
                },
              },
            },
          },
        })
      ).map((item) => ({
        id: item.id,
        key: item.key,
        title: item.title,
        status: item.status,
        position: item.position,
        researchType: item.tags[0] ?? null,
        assignee:
          item.assignee ??
          (item.issueLinks
            .map((link) => link.issue?.assignee)
            .find(Boolean) ?? null),
        dueDate: item.dueDate ? item.dueDate.toISOString() : null,
        linkedIssuesCount: item.issueLinks.length,
        updatedAt: item.updatedAt.toISOString(),
      }))
    : [];

  const backlogGroups: BacklogGroup[] = backlogProject
    ? [
        ...backlogProject.sprints.map((sprint) => ({
          id: sprint.id,
          name: sprint.name,
          type: "sprint" as const,
          status: sprint.status,
          issues: backlogProject.issues.filter(
            (issue) => issue.sprintId === sprint.id
          ),
        })),
        {
          id: "backlog",
          name: "Product Backlog",
          type: "backlog",
          issues: backlogProject.issues.filter((issue) => issue.sprintId === null),
        },
      ]
    : [];

  const assigneeOptions = projectMembers
    .map((member) => member.user)
    .filter(Boolean)
    .map((user) => ({ id: user!.id, label: user!.name ?? "Unassigned" }));

  const epicOptions = epics.map((epic) => ({ id: epic.id, label: epic.title }));

  const manageTeamLink = (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Project: <span className="font-medium">{project.name}</span>
      </p>
      {projectRole && (projectRole === "ADMIN" || projectRole === "PO") && (
        <Button asChild>
          <Link href={`/projects/${projectId}/settings#team`}>Manage Team</Link>
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
        backlogGroups={backlogGroups}
        assigneeOptions={assigneeOptions}
        epicOptions={epicOptions}
        enableResearchBoard={project.enableResearchBoard}
        researchItems={researchItems}
        initialSegment={activeSegment}
      />
    </div>
  );
}
