import { notFound, redirect } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import ReportModulePlaceholder from "@/components/reports/project/ReportModulePlaceholder";
import ReportPageLayout from "@/components/reports/project/ReportPageLayout";
import CycleTimeModule from "@/components/reports/project/CycleTimeModule";
import BlockerThemesModule from "@/components/reports/project/BlockerThemesModule";
import StandupInsightsModule from "@/components/reports/project/StandupInsightsModule";
import SprintBurndownModule from "@/components/reports/project/SprintBurndownModule";
import VelocityTrendModule from "@/components/reports/project/VelocityTrendModule";
import prisma from "@/lib/db";
import { getCurrentProjectContext } from "@/lib/projectContext";
import {
  DEFAULT_REPORT_MODULE,
  normalizeModule,
  parseReportSearchParams,
  type ReportModuleKey,
} from "@/lib/reports/filters";
import { Role as UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type ServerProps = {
  params: { projectId: string } | Promise<{ projectId: string }>;
  searchParams?: unknown;
};

const reportModules: ReadonlyArray<{
  key: ReportModuleKey;
  title: string;
  description: string;
  requiresSprintScope: boolean;
}> = [
  {
    key: "sprint-burndown",
    title: "Sprint Burndown",
    description: "Track remaining scope against time to spot at-risk sprints early.",
    requiresSprintScope: true,
  },
  {
    key: "velocity-trend",
    title: "Velocity Trend",
    description: "See delivery momentum across recent sprints to forecast capacity.",
    requiresSprintScope: true,
  },
  {
    key: "cycle-time",
    title: "Cycle Time",
    description: "Measure how long issues take from start to finish to surface bottlenecks.",
    requiresSprintScope: true,
  },
  {
    key: "standup-insights",
    title: "Standup Insights",
    description: "Summarize daily standup updates to highlight risks and progress.",
    requiresSprintScope: false,
  },
  {
    key: "blocker-themes",
    title: "Blocker Themes",
    description: "Aggregate blockers to understand recurring impediments across the team.",
    requiresSprintScope: false,
  },
];

type SprintOption = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

const getActiveModule = (moduleKey: string | null): (typeof reportModules)[number] => {
  const resolvedKey = normalizeModule(moduleKey);
  return reportModules.find((module) => module.key === resolvedKey) ?? reportModules[0];
};

export default async function ProjectReportsPage(props: ServerProps) {
  const resolvedParams = await props.params;
  const projectId = resolvedParams?.projectId;

  if (!projectId) return notFound();

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!user) {
    redirect("/login");
  }

  const isLeadership = user.role === UserRole.ADMIN || user.role === UserRole.PO;

  if (!isLeadership) {
    redirect(`/projects/${projectId}/backlog`);
  }

  if (!project) return notFound();

  const projectRole = mapRole((membership?.role as ProjectRole | null) ?? null, user.role ?? null);
  const roleLabel = projectRole ?? "Member";

  const parsedSearchParams = parseReportSearchParams(props.searchParams ?? null);
  const activeModule = getActiveModule(parsedSearchParams.module as ReportModuleKey);

  const sprints: SprintOption[] = (
    await prisma.sprint.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    })
  ).map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate ? sprint.startDate.toISOString().slice(0, 10) : null,
    endDate: sprint.endDate ? sprint.endDate.toISOString().slice(0, 10) : null,
  }));

  const renderModule = () => {
    switch (activeModule.key) {
      case "sprint-burndown":
        return (
          <SprintBurndownModule
            projectId={projectId}
            initialFilters={parsedSearchParams.filters}
            sprints={sprints}
          />
        );
      case "velocity-trend":
        return (
          <VelocityTrendModule
            projectId={projectId}
            initialFilters={parsedSearchParams.filters}
            sprints={sprints}
          />
        );
      case "cycle-time":
        return (
          <CycleTimeModule
            projectId={projectId}
            initialFilters={parsedSearchParams.filters}
          />
        );
      case "standup-insights":
        return (
          <StandupInsightsModule
            projectId={projectId}
            initialFilters={parsedSearchParams.filters}
          />
        );
      case "blocker-themes":
        return (
          <BlockerThemesModule
            projectId={projectId}
            initialFilters={parsedSearchParams.filters}
          />
        );
      default:
        {
          const moduleInfo = reportModules[0];
          return (
            <ReportModulePlaceholder
              title={moduleInfo.title}
              description={moduleInfo.description}
              helper={
                moduleInfo.requiresSprintScope && sprints.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Add your first sprint to unlock velocity and burndown insights. Visit the
                    <a className="text-primary underline" href={`/projects/${projectId}/sprints`}>
                      {" "}Sprints tab
                    </a>{" "}
                    to create one.
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Use the filters above to focus the report before we add visualizations.
                  </p>
                )
              }
            />
          );
        }
    }
  };

  return (
    <div className="space-y-4">
      <ProjectHeader
        projectName={project.name}
        projectKey={project.key ?? project.name}
        projectDescription={project.description}
        projectIconUrl={project.iconUrl}
        currentUserName={user?.name}
        currentUserEmail={user?.email}
        roleLabel={roleLabel}
      />

      <ProjectTabs projectId={projectId} active="reports" />

      <ReportPageLayout
        projectId={projectId}
        modules={reportModules}
        activeModule={activeModule}
        sprints={sprints}
        filters={parsedSearchParams.filters}
        showSprintSelect={activeModule.requiresSprintScope}
      >
        {renderModule()}
      </ReportPageLayout>
    </div>
  );
}
