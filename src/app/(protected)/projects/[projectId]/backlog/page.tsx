import prisma from "@/lib/db";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { notFound } from "next/navigation";
import Link from "next/link";
import BacklogPageClient from "./pageClient";

type Props = {
  params: { projectId: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function BacklogPage({ params }: Props) {
  const { projectId } = params;

  // Extra logging to debug issues in production logs
  console.log("[ProjectBacklogPage] params:", params);
  console.log("[ProjectBacklogPage] resolved projectId:", projectId);

  if (!projectId) {
    console.warn("[ProjectBacklogPage] Missing projectId, returning 404");
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sprints: {
        orderBy: { createdAt: "asc" },
      },
      issues: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    console.warn("[ProjectBacklogPage] No project found for id", projectId);
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
