import Link from "next/link";
import { notFound } from "next/navigation";
import { ReactNode } from "react";

import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type ServerLayoutProps = {
  children: ReactNode;
  params: { projectId: string } | Promise<{ projectId: string }>;
};

export default async function ProjectLayout({ children, params }: ServerLayoutProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams?.projectId;

  if (!projectId) {
    notFound();
  }

  const { project, membership, user } = await getCurrentProjectContext(projectId);

  if (!project) {
    notFound();
  }

  const projectRole = mapRole(
    (membership?.role as ProjectRole | null) ?? null,
    user?.role ?? null
  );

  const tabs = [
    { href: `/projects/${projectId}/backlog`, label: "Backlog" },
    { href: `/projects/${projectId}/board`, label: "Board" },
    { href: `/projects/${projectId}/sprints`, label: "Sprints" },
    { href: `/projects/${projectId}/reports`, label: "Reports" },
    { href: `/projects/${projectId}/team`, label: "Team" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Project header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Project</div>
          <div className="text-lg font-semibold text-slate-900">
            {project.key} · {project.name}
          </div>
          {project.description && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {user && (
            <div className="text-right">
              <div className="font-semibold text-slate-800">{user.name ?? "You"}</div>
              <div>{user.email}</div>
              {projectRole && (
                <div className="mt-0.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Role: {projectRole}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-lg border-b border-slate-200 bg-white px-4 pt-2">
        <nav className="-mb-px flex gap-4 text-sm">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="border-b-2 border-transparent px-1 pb-2 text-slate-600 hover:border-blue-500 hover:text-blue-600 data-[active=true]:border-blue-600 data-[active=true]:font-semibold data-[active=true]:text-blue-700"
              data-active={undefined /* let client highlight via current route if desired */}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Page content */}
      <div className="mt-2">{children}</div>
    </div>
  );
}
