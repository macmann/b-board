import { redirect } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import {
  BuildStatus,
  IssueHistoryField,
  IssueStatus,
  IssueType,
  IssuePriority,
  ResearchStatus,
  Role,
  SprintStatus,
} from "@/lib/prismaEnums";
import prisma from "@/lib/db";
import { routes } from "@/lib/routes";
import DeliveryHealthSection from "./DeliveryHealthSection";

type IssueCountGroup = { projectId: string; status: IssueStatus; _count: { _all: number } };
type BlockerCountGroup = { projectId: string; _count: { _all: number } };
type WorkloadGroup = { assigneeId: string | null; _count: { _all: number } };

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

const buildSprintIssueStats = (
  sprintIds: string[],
  issueCounts: Array<{ sprintId: string | null; status: IssueStatus; _count: { _all: number } }>
) => {
  const defaultStats = Object.fromEntries(
    sprintIds.map((sprintId) => [sprintId, { total: 0, done: 0 }])
  );

  issueCounts.forEach(({ sprintId, status, _count }) => {
    if (!sprintId) return;

    const stats = defaultStats[sprintId];
    if (!stats) return;

    const count = typeof _count === "number" ? _count : _count?._all ?? 0;

    stats.total += count;

    if (status === IssueStatus.DONE) {
      stats.done += count;
    }
  });

  return defaultStats;
};

const buildBurndownSeries = (
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  issues: Array<{
    storyPoints: number | null;
    status: IssueStatus;
    history: Array<{ newValue: IssueStatus; createdAt: Date }>;
  }>
) => {
  if (!startDate || !endDate) {
    return [] as { date: string; remainingPoints: number }[];
  }

  const totalPoints = issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);

  const completionDates = issues.map((issue) => {
    const doneChange = issue.history.find((entry) => entry.newValue === IssueStatus.DONE);

    return {
      points: issue.storyPoints ?? 0,
      completion: doneChange
        ? (doneChange.createdAt as Date | null)
        : issue.status === IssueStatus.DONE
          ? endDate
          : null,
    };
  });

  const burndown: { date: string; remainingPoints: number }[] = [];

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const completedByDay = completionDates.reduce((sum, issue) => {
      if (issue.completion !== null && issue.completion <= currentDate) {
        return sum + issue.points;
      }
      return sum;
    }, 0);

    burndown.push({
      date: currentDate.toISOString().split("T")[0],
      remainingPoints: Math.max(totalPoints - completedByDay, 0),
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return burndown;
};

const buildPriorityStats = (
  counts: Array<{ priority: IssuePriority; _count: { _all: number } }>
) => {
  const defaultStats: Record<IssuePriority, number> = {
    [IssuePriority.CRITICAL]: 0,
    [IssuePriority.HIGH]: 0,
    [IssuePriority.MEDIUM]: 0,
    [IssuePriority.LOW]: 0,
  };

  counts.forEach(({ priority, _count }) => {
    const count = typeof _count === "number" ? _count : _count?._all ?? 0;
    defaultStats[priority] = count;
  });

  return defaultStats;
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
  const staleThreshold = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const [
    issueCounts,
    activeSprints,
    blockerCounts,
    newBugsToday,
    failedBuildsLastDay,
    overdueIssues,
    staleIssues,
    workloadGroups,
  ]: [
    IssueCountGroup[],
    Array<{
      id: string;
      name: string;
      projectId: string;
      startDate: Date | null;
      endDate: Date | null;
    }>,
    BlockerCountGroup[],
    number,
    number,
    number,
    number,
    WorkloadGroup[],
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
          select: {
            id: true,
            name: true,
            projectId: true,
            startDate: true,
            endDate: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([] as Array<{
          id: string;
          name: string;
          projectId: string;
          startDate: Date | null;
          endDate: Date | null;
        }>),
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
    projectIds.length
      ? prisma.issue.count({
          where: {
            projectId: { in: projectIds },
            status: { not: IssueStatus.DONE },
            updatedAt: { lt: staleThreshold },
          },
        })
      : Promise.resolve(0),
    projectIds.length
      ? prisma.issue.groupBy({
          by: ["assigneeId"],
          where: {
            projectId: { in: projectIds },
            status: { not: IssueStatus.DONE },
            assigneeId: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { _all: "desc" } },
          take: 3,
        })
      : Promise.resolve([] as WorkloadGroup[]),
  ]);

  const statsByProjectId = buildIssueStats(projectIds, issueCounts);
  const blockersByProjectId = buildBlockerCounts(projectIds, blockerCounts);

  const activeSprintIds = activeSprints.map((sprint) => sprint.id);
  const healthSprints = activeSprints.slice(0, 3);

  const [
    bugSeverityTodayCounts,
    bugSeveritySprintCounts,
    recentBuilds,
    latestFailedBuild,
  ] = await Promise.all([
    projectIds.length
      ? prisma.issue.groupBy({
          by: ["priority"],
          where: {
            projectId: { in: projectIds },
            type: IssueType.BUG,
            createdAt: { gte: todayDate, lt: tomorrowDate },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ priority: IssuePriority; _count: { _all: number } }>),
    projectIds.length && activeSprintIds.length
      ? prisma.issue.groupBy({
          by: ["priority"],
          where: {
            projectId: { in: projectIds },
            type: IssueType.BUG,
            sprintId: { in: activeSprintIds },
          },
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ priority: IssuePriority; _count: { _all: number } }>),
    projectIds.length
      ? prisma.build.findMany({
          where: { projectId: { in: projectIds } },
          include: { project: { select: { name: true, key: true } } },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.build.findMany>>),
    projectIds.length
      ? prisma.build.findFirst({
          where: {
            projectId: { in: projectIds },
            status: { in: [BuildStatus.ROLLED_BACK, BuildStatus.CANCELLED] },
          },
          include: { project: { select: { name: true, key: true } } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve(null),
  ]);
  const sprintIssueCounts = healthSprints.length
    ? await prisma.issue.groupBy({
        by: ["sprintId", "status"],
        where: { sprintId: { in: healthSprints.map((sprint) => sprint.id) } },
        _count: { _all: true },
      })
    : [];

  const scopeChangesBySprint: Record<string, number> = Object.fromEntries(
    await Promise.all(
      healthSprints.map(async (sprint) => {
        if (!sprint.startDate) {
          return [sprint.id, 0];
        }

        const scopeChanges = await prisma.issue.count({
          where: {
            sprintId: sprint.id,
            createdAt: { gt: sprint.startDate },
          },
        });

        return [sprint.id, scopeChanges];
      })
    )
  );

  const burndownBySprint: Record<string, { date: string; remainingPoints: number }[]> = Object.fromEntries(
    await Promise.all(
      healthSprints.map(async (sprint) => {
        const issues = await prisma.issue.findMany({
          where: { sprintId: sprint.id },
          select: {
            storyPoints: true,
            status: true,
            history: {
              where: { field: IssueHistoryField.STATUS },
              orderBy: { createdAt: "asc" },
              select: {
                newValue: true,
                createdAt: true,
              },
            },
          },
        });

        return [
          sprint.id,
          buildBurndownSeries(sprint.startDate ?? null, sprint.endDate ?? null, issues),
        ];
      })
    )
  );

  const sprintIssueStats = buildSprintIssueStats(
    healthSprints.map((sprint) => sprint.id),
    sprintIssueCounts
  );

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

  const bugsTodayByPriority = buildPriorityStats(bugSeverityTodayCounts);
  const sprintBugsByPriority = buildPriorityStats(bugSeveritySprintCounts);

  const priorityOrder: IssuePriority[] = [
    IssuePriority.CRITICAL,
    IssuePriority.HIGH,
    IssuePriority.MEDIUM,
    IssuePriority.LOW,
  ];

  const priorityLabels: Record<IssuePriority, string> = {
    [IssuePriority.CRITICAL]: "Critical",
    [IssuePriority.HIGH]: "High",
    [IssuePriority.MEDIUM]: "Medium",
    [IssuePriority.LOW]: "Low",
  };

  const priorityDots: Record<IssuePriority, string> = {
    [IssuePriority.CRITICAL]: "bg-rose-500",
    [IssuePriority.HIGH]: "bg-amber-500",
    [IssuePriority.MEDIUM]: "bg-sky-500",
    [IssuePriority.LOW]: "bg-emerald-500",
  };

  const buildStatusStyles: Record<(typeof BuildStatus)[keyof typeof BuildStatus], string> = {
    [BuildStatus.PLANNED]: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    [BuildStatus.IN_PROGRESS]: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100",
    [BuildStatus.DEPLOYED]: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100",
    [BuildStatus.ROLLED_BACK]: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100",
    [BuildStatus.CANCELLED]: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100",
  };

  const bugsTodayTotal = Object.values(bugsTodayByPriority).reduce(
    (sum, count) => sum + count,
    0
  );

  const sprintBugTotal = Object.values(sprintBugsByPriority).reduce(
    (sum, count) => sum + count,
    0
  );

  const sprintHealthRows = healthSprints.map((sprint) => ({
    ...sprint,
    projectName: projectLookup.get(sprint.projectId)?.project.name ?? "Unknown project",
    totalIssues: sprintIssueStats[sprint.id]?.total ?? 0,
    doneIssues: sprintIssueStats[sprint.id]?.done ?? 0,
    scopeChanges: scopeChangesBySprint[sprint.id] ?? 0,
    burndown: burndownBySprint[sprint.id] ?? [],
  }));

  const workloadUserIds = workloadGroups
    .map((group) => group.assigneeId)
    .filter((id): id is string => Boolean(id));

  const workloadUsers = workloadUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: workloadUserIds } },
        select: { id: true, name: true, email: true },
      })
    : [];

  const workloadByUser = workloadGroups
    .map((group) => {
      const count = typeof group._count === "number" ? group._count : group._count?._all ?? 0;
      const user = workloadUsers.find((candidate) => candidate.id === group.assigneeId);

      if (!user) return null;

      return { user, count };
    })
    .filter((entry): entry is { user: { id: string; name: string; email: string }; count: number } =>
      Boolean(entry)
    );

  const researchEnabledProjects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds }, enableResearchBoard: true },
        select: { id: true, name: true, key: true },
      })
    : [];

  const researchInProgress = researchEnabledProjects.length
    ? await prisma.researchItem.findMany({
        where: {
          projectId: { in: researchEnabledProjects.map((project) => project.id) },
          status: ResearchStatus.IN_PROGRESS,
        },
        select: { id: true, title: true, key: true, projectId: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      })
    : [];

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

  const renderSeverityList = (
    counts: Record<IssuePriority, number>,
    total: number
  ) => {
    if (total === 0) {
      return (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          No bugs in this window.
        </p>
      );
    }

    const maxCount = Math.max(...priorityOrder.map((priority) => counts[priority] ?? 0));

    return (
      <ul className="mt-4 space-y-3">
        {priorityOrder.map((priority) => {
          const value = counts[priority] ?? 0;
          const barWidth = maxCount ? Math.max((value / maxCount) * 100, 8) : 0;

          return (
            <li key={priority} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${priorityDots[priority]}`} />
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {priorityLabels[priority]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-28 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="w-8 text-right font-semibold text-slate-900 dark:text-slate-50">
                  {value}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

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

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Team Signals</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Scrum Master insights</h2>
            <div className="mt-4 grid gap-6 lg:grid-cols-3">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-50">
                  <span>Blockers reported today</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                    {totalBlockers}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold text-slate-900 dark:text-slate-50">
                  <span>Stale issues (&gt;3 days no update)</span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                    {staleIssues}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Top workload</p>
                {workloadByUser.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No assigned work in progress.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {workloadByUser.map(({ user, count }) => (
                      <li
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-50">{user.name}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">{user.email}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                          {count} item{count === 1 ? "" : "s"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Research in progress</p>
                {researchEnabledProjects.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Research board is not enabled for your projects.</p>
                ) : researchInProgress.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">No research tasks currently in progress.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {researchInProgress.map((item) => {
                      const project = researchEnabledProjects.find((project) => project.id === item.projectId);
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-50">{item.title}</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {project ? `${project.name} · ${item.key || "Unkeyed"}` : "Research"}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100">
                            In progress
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Quality
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Quality &amp; Stability</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Bug severity snapshots and build reliability across your projects.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Updated today
              </span>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Bugs by severity
                      </p>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Today</h3>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                      {bugsTodayTotal} bug{bugsTodayTotal === 1 ? "" : "s"}
                    </span>
                  </div>
                  {renderSeverityList(bugsTodayByPriority, bugsTodayTotal)}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Bugs by severity
                      </p>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Current sprint</h3>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                      {activeSprintIds.length ? sprintBugTotal : 0} bug{sprintBugTotal === 1 ? "" : "s"}
                    </span>
                  </div>
                  {activeSprintIds.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      No active sprints right now.
                    </p>
                  ) : (
                    renderSeverityList(sprintBugsByPriority, sprintBugTotal)
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Last failed build
                  </p>
                  {latestFailedBuild ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {latestFailedBuild.project.name} · {latestFailedBuild.key}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {latestFailedBuild.status} at {latestFailedBuild.updatedAt.toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      No failed builds reported recently.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Build history
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Recent deployments</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm dark:bg-slate-900 dark:text-slate-200">
                    Last 5
                  </span>
                </div>

                {recentBuilds.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                    Builds are not configured for your projects yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {recentBuilds.map((build) => (
                      <li
                        key={build.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-50">
                            {build.project.name} · {build.key}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {build.name ?? "Unlabeled build"} • {build.updatedAt.toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${buildStatusStyles[build.status]}`}
                        >
                          {build.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <DeliveryHealthSection sprints={sprintHealthRows} />

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
