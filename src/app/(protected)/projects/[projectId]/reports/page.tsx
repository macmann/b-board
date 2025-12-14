import { notFound, redirect } from "next/navigation";

import ReportCard, { reportModules } from "@/components/reports/ReportCard";
import ProjectHeader from "@/components/projects/ProjectHeader";
import ProjectTabs from "@/components/projects/ProjectTabs";
import { getCurrentProjectContext } from "@/lib/projectContext";
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

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Report modules</p>
          <div className="mt-4 space-y-2">
            {reportModules.map((module) => (
              <a
                key={module.key}
                href={`#${module.key}`}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {module.title}
              </a>
            ))}
          </div>
        </aside>

        <div className="grid gap-4 md:grid-cols-2">
          {reportModules.map((module) => (
            <div key={module.key} id={module.key} className="scroll-mt-24">
              <ReportCard
                module={module}
                scope="project"
                footer="Project-scoped reporting will surface sprint, velocity, and delivery insights tailored to this project."
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
