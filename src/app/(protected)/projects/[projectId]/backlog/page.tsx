import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { resolveProjectId, type ProjectParams } from "@/lib/params";

import BacklogPageClient from "./pageClient";

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

export default async function ProjectBacklogPage({ params }: Props) {
  // Use the shared helper so we work with both plain objects and Promises
  const projectId = await resolveProjectId(params);

  console.log("[ProjectBacklogPage] resolved projectId:", projectId);

  if (!projectId) {
    console.warn("[ProjectBacklogPage] Missing projectId, returning 404");
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

  const manageTeamLink = (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-sm text-gray-600">
        Project: <span className="font-medium">{project.name}</span>
      </p>
      {projectRole && (projectRole === "ADMIN" || projectRole === "PO") && (
        <Link
          href={`/projects/${projectId}/team`}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Manage Team
        </Link>
      )}
    </div>
  );

  return (
    <BacklogPageClient
      projectId={projectId}
      projectRole={projectRole}
      manageTeamLink={manageTeamLink}
    />
  );
}
