import ProjectTeamSettings from "@/components/projects/ProjectTeamSettings";
import ProjectEmailSettings from "@/components/projects/ProjectEmailSettings";
import { Role } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";

type TeamPermissionsTabProps = {
  isAdmin: boolean;
  members: {
    id: string;
    createdAt?: string;
    role: Role;
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }[];
  projectId: string;
  projectRole: ProjectRole | null;
};

export default function TeamPermissionsTab({
  isAdmin,
  members,
  projectId,
  projectRole,
}: TeamPermissionsTabProps) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Team & Permissions
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manage who can access this project and their roles.
          </p>
        </div>
        {!isAdmin && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Only admins and product owners can change team membership.
          </p>
        )}
      </div>

      <ProjectTeamSettings
        projectId={projectId}
        projectRole={projectRole}
        showHeader={false}
        initialMembers={members}
      />

      <ProjectEmailSettings
        projectId={projectId}
        projectRole={projectRole}
        isWorkspaceAdmin={isAdmin}
      />
    </section>
  );
}
