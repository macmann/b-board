import { notFound } from "next/navigation";
import Link from "next/link";

import { UserRole } from "../../../../../lib/prismaEnums";
import prisma from "../../../../../lib/db";
import { getCurrentProjectContext } from "../../../../../lib/projectContext";
import { ProjectRole } from "../../../../../lib/roles";
import BacklogPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type Props = {
  params: { projectId: string };
};

export default async function ProjectBacklogPage({ params }: Props) {
  const { projectId } = params;

  if (!projectId) {
    throw new Error("Missing projectId in route params");
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
      projectId={params.projectId}
      projectRole={projectRole}
      manageTeamLink={
        <Link
          href={`/projects/${params.projectId}/team`}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Manage Team
        </Link>
      }
    />
  );
}
