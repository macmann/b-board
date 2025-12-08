import { prisma } from "@/lib/db";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import Link from "next/link";
import { notFound } from "next/navigation";
import BacklogPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type Props = {
  params: any;
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProjectBacklogPage({ params }: Props) {
  console.log("DEBUG_BACKLOG_PARAMS", params, Object.keys(params ?? {}));

  // if (!params.projectId) {
  //   throw new Error("Missing projectId in route params");
  // }

  const projectId =
    (params && (params as any).projectId) ??
    (params && (params as any).id) ??
    (params && (params as any).projectID) ??
    (params && Object.values(params)[0]);

  console.log("DEBUG_BACKLOG_PROJECT_ID", projectId);

  if (!projectId) {
    console.error("BACKLOG: Could not resolve projectId from params:", params);
    return <div>Could not resolve project ID.</div>;
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sprints: true,
      issues: true,
    },
  });

  if (!project) {
    notFound();
  }

  const { membership, user } = await getCurrentProjectContext(projectId);
  const projectRole = mapRole(membership?.role as ProjectRole | null, user?.role ?? null);

  return (
    <BacklogPageClient
      projectId={projectId}
      projectRole={projectRole}
      manageTeamLink={
        <Link
          href={`/projects/${projectId}/team`}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Manage Team
        </Link>
      }
    />
  );
}
