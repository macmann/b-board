import { redirect } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import {
  BuildStatus,
  IssueStatus,
  IssueType,
  Role,
  SprintStatus,
} from "@/lib/prismaEnums";
import prisma from "@/lib/db";
import { routes } from "@/lib/routes";

type IssueCountGroup = { projectId: string; status: IssueStatus; _count: { _all: number } };
type BlockerCountGroup = { projectId: string; _count: { _all: number } };

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

export default async function DashboardPage() {
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
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    issueCounts,
    activeSprints,
    blockerCounts,
    newBugsToday,
    failedBuildsLastDay,
    overdueIssues,
  ]: [
    IssueCountGroup[],
    Array<{ id: string; name: string; projectId: string }>,
    BlockerCountGroup[],
    number,
    number,
    number,
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
    projectIds.length
      ? prisma.issue.count({
          where: {
            projectId: { in: projectIds },
            type: IssueType.BUG,
            createdAt: { gte: todayDate, lt: tomorrowDate },
          },
        })
      : Promise.resolve(0),
    projectIds.length
      ? prisma.build.count({
          where: {
            projectId: { in: projectIds },
            status: { in: [BuildStatus.ROLLED_BACK, BuildStatus.CANCELLED] },
            updatedAt: { gte: last24Hours },
          },
        })
      : Promise.resolve(0),
    projectIds.length
      ? prisma.issue.count({
          where: {
            projectId: { in: projectIds },
            status: { not: IssueStatus.DONE },
            sprint: { endDate: { lt: todayDate } },
          },
        })
      : Promise.resolve(0),
  ]);

  const statsByProjectId = buildIssueStats(projectIds, issueCounts);
  const blockersByProjectId = buildBlockerCounts(projectIds, blockerCounts);

  const totalStats = Object.values(statsByProjectId).reduce(
    (totals, stats) => ({
      todo: totals.todo + stats.todo,
      inProgress: totals.inProgress + stats.inProgress,
      done: totals.done + stats.done,
    }),
    { todo: 0, inProgress: 0, done: 0 }
  );

  const totalBlockers = blockerCounts.reduce((total, { _count }) => {
    const count = typeof _count === "number" ? _count : _count?._all ?? 0;
    return total + count;
  }, 0);

  const projectLookup = new Map(memberships.map((membership) => [membership.project.id, membership]));

  const blockerProjects = Object.entries(blockersByProjectId)
    .filter(([, count]) => count > 0)
    .map(([projectId, count]) => ({
      projectId,
      projectName: projectLookup.get(projectId)?.project.name ?? "Unknown project",
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const sprintRows = activeSprints.map((sprint) => ({
    ...sprint,
    projectName: projectLookup.get(sprint.projectId)?.project.name ?? "Unknown project",
  }));

  const kpis = [
    { label: "New bugs today", value: newBugsToday },
    { label: "Open blockers", value: totalBlockers },
    { label: "Overdue issues", value: overdueIssues },
    { label: "Failed builds (24h)", value: failedBuildsLastDay },
    { label: "Active sprints", value: activeSprints.length },
  ];

  const statusCards = [
    {
      label: "Todo",
      value: totalStats.todo,
      description: "Ready to be picked up",
    },
    {
      label: "In progress",
      value: totalStats.inProgress,
      description: "Actively being worked",
    },
    {
      label: "Done",
      value: totalStats.done,
      description: "Completed and accepted",
    },
  ];

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Portfolio overview
        </p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-50">Workspace dashboard</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Aggregated delivery and quality signals across every project you can access.
        </p>
      </div>

      {projectIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">No projects yet</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            When you create or join projects, workspace analytics will populate automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {kpi.label}
                </p>
                <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-50">
                  {typeof kpi.value === "number" ? kpi.value : "No data"}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Delivery throughput
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                    Status distribution across all work
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {totalStats.todo + totalStats.inProgress + totalStats.done} issues
                </span>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {statusCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">{item.value}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Blockers</p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Standup highlights</h2>
              {blockerProjects.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No blockers reported today.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {blockerProjects.map((blocker) => (
                    <li
                      key={blocker.projectId}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50">{blocker.projectName}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Reported in today&apos;s standup</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-100">
                        {blocker.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sprints</p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Active sprint lineup</h2>
              {sprintRows.length === 0 ? (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">No active sprints right now.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {sprintRows.map((sprint) => (
                    <li
                      key={sprint.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-50">{sprint.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{sprint.projectName}</p>
                      </div>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                        Active
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Access</p>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Projects in your workspace</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {memberships.length} project{memberships.length === 1 ? "" : "s"} visible with your current access.
              </p>
              <div className="mt-4 space-y-2">
                {memberships.map((membership) => (
                  <div
                    key={membership.project.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-50">{membership.project.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{membership.project.key}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {membership.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
