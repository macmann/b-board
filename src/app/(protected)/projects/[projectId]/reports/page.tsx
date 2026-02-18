import { notFound, redirect } from "next/navigation";

import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import ProjectReportsClient from "@/components/reports/project/ProjectReportsClient";
import type { ReportModuleNavItem } from "@/components/reports/project/ReportModuleNav";
import prisma from "@/lib/db";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { parseReportSearchParams } from "@/lib/reports/filters";
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

const reportModules: ReadonlyArray<ReportModuleNavItem & { requiresSprintScope: boolean }> = [
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
    key: "sprint-health",
    title: "Sprint Health",
    description: "Deterministic risk score with trend, attribution, and spillover forecast.",
    requiresSprintScope: false,
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

      <ProjectReportsClient
        projectId={projectId}
        modules={reportModules}
        sprints={sprints}
        initialFilters={parsedSearchParams.filters}
      />
    </div>
  );
}
