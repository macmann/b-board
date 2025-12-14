import Link from "next/link";
import { redirect } from "next/navigation";

import Button from "@/components/ui/Button";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { IssueStatus, Role, SprintStatus } from "@/lib/prismaEnums";
import prisma from "@/lib/db";
import { routes } from "@/lib/routes";

import ProjectFilter from "./ProjectFilter";

type DashboardProject = {
  id: string;
  name: string;
  role: Role;
  activeSprint: { id: string; name: string } | null;
  stats: {
    todo: number;
    inProgress: number;
    done: number;
  };
  blockers: number;
};

type IssueCountGroup = { projectId: string; status: IssueStatus; _count: { _all: number } };
type BlockerCountGroup = { projectId: string; _count: { _all: number } };

const formatRole = (role: Role) => {
  switch (role) {
    case Role.ADMIN:
      return "Admin";
    case Role.PO:
      return "Product Owner";
    case Role.DEV:
      return "Developer";
    case Role.QA:
      return "QA";
    default:
      return "Viewer";
  }
};

const buildIssueStats = (
  projectIds: string[],
  issueCounts: Array<{ projectId: string; status: IssueStatus; _count: { _all: number } }>
) => {
  const defaultStats = Object.fromEntries(
    projectIds.map((projectId) => [projectId, { todo: 0, inProgress: 0, done: 0 }])
  );

  issueCounts.forEach(({ projectId, status, _count }) => {
    const stats = defaultStats[projectId];
    if (!stats) return;

    const count = typeof _count === "number" ? _count : _count?._all ?? 0;

    if (status === IssueStatus.TODO) {
      stats.todo += count;
    }

    if (status === IssueStatus.IN_PROGRESS || status === IssueStatus.IN_REVIEW) {
      stats.inProgress += count;
    }

    if (status === IssueStatus.DONE) {
      stats.done += count;
    }
  });

  return defaultStats;
};

const buildBlockerCounts = (
  projectIds: string[],
  blockerCounts: Array<{ projectId: string; _count: { _all: number } }>
) => {
  const defaultCounts = Object.fromEntries(projectIds.map((projectId) => [projectId, 0]));

  blockerCounts.forEach(({ projectId, _count }) => {
    const count = typeof _count === "number" ? _count : _count?._all ?? 0;
    defaultCounts[projectId] = count;
  });

  return defaultCounts;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { projectId?: string };
}) {
  const { user } = await getCurrentProjectContext();

  if (!user) {
    redirect(routes.login());
  }

  const isLeadership = user.role === Role.ADMIN || user.role === Role.PO;

  if (!isLeadership) {
    redirect(routes.myProjects());
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          key: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const projectIds = memberships.map((membership) => membership.project.id);

  const today = new Date();
  const todayDate = new Date(today.toISOString().slice(0, 10));

  const [issueCounts, activeSprints, blockerCounts]: [
    IssueCountGroup[],
    Array<{ id: string; name: string; projectId: string }>,
    BlockerCountGroup[]
  ] = await Promise.all([
    projectIds.length
      ? prisma.issue.groupBy({
          by: ["projectId", "status"],
          where: { projectId: { in: projectIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as IssueCountGroup[]),
    projectIds.length
      ? prisma.sprint.findMany({
          where: { projectId: { in: projectIds }, status: SprintStatus.ACTIVE },
          select: { id: true, name: true, projectId: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; projectId: string }>),
    projectIds.length
      ? prisma.dailyStandupEntry.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            date: todayDate,
            blockers: { not: null },
            NOT: { blockers: "" },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as BlockerCountGroup[]),
  ]);

  const statsByProjectId = buildIssueStats(projectIds, issueCounts);
  const blockersByProjectId = buildBlockerCounts(projectIds, blockerCounts);
  const activeSprintsByProjectId = Object.fromEntries(
    activeSprints.map((sprint) => [sprint.projectId, { id: sprint.id, name: sprint.name }])
  );

  const projects: DashboardProject[] = memberships.map((membership) => ({
    id: membership.project.id,
    name: membership.project.name,
    role: membership.role,
    activeSprint: activeSprintsByProjectId[membership.project.id] ?? null,
    stats:
      statsByProjectId[membership.project.id] ??
      ({ todo: 0, inProgress: 0, done: 0 } satisfies DashboardProject["stats"]),
    blockers: blockersByProjectId[membership.project.id] ?? 0,
  }));

  const selectedProjectId = searchParams?.projectId;
  const filteredProjects = selectedProjectId
    ? projects.filter((project) => project.id === selectedProjectId)
    : projects;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Dashboard</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Cross-project health overview for your workspace.
          </p>
        </div>
        <ProjectFilter
          projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          selectedProjectId={selectedProjectId}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">No projects yet</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            When you create or join projects, their health will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                    {project.name}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{formatRole(project.role)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Active sprint
                </span>
              </div>

              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {project.activeSprint ? "Sprint" : "No active sprint"}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-50">
                  {project.activeSprint ? project.activeSprint.name : "Start a sprint to see progress"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Todo</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{project.stats.todo}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    In Progress
                  </p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{project.stats.inProgress}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Done</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{project.stats.done}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Blockers</p>
                  <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">{project.blockers}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Today&apos;s standup</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button asChild>
                  <Link href={`/projects/${project.id}/backlog`}>Open Project</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
