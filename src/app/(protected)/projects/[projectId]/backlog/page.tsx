import prisma from "@/lib/db";
import { getCurrentProjectContext } from "@/lib/projectContext";
import { UserRole } from "@/lib/prismaEnums";
import { ProjectRole } from "@/lib/roles";
import { notFound } from "next/navigation";
import BacklogPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

// This page is currently being called with a weird "params" shape from Next/Codex:
// - Sometimes as { params: { projectId: string } }
// - Sometimes as Promise<{ projectId: string }>
// To make it bulletproof, we normalize whatever we receive into a plain { projectId } object.
async function normalizeProjectParams(raw: any): Promise<{ projectId: string | null }> {
  let candidate: any = raw;

  // If Next passes { params, searchParams }, unwrap params first
  if (candidate && typeof candidate === "object" && "params" in candidate) {
    candidate = candidate.params;
  }

  // If we somehow got a Promise, await it
  if (candidate && typeof candidate === "object" && "then" in candidate) {
    candidate = await candidate;
  }

  const projectId =
    candidate && typeof candidate === "object"
      ? (candidate.projectId as string | undefined)
      : undefined;

  return { projectId: projectId ?? null };
}

export default async function ProjectBacklogPage(raw: any) {
  const { projectId } = await normalizeProjectParams(raw);

  console.log("[ProjectBacklogPage] raw props:", raw);
  console.log("[ProjectBacklogPage] normalized projectId:", projectId);

  if (!projectId) {
    console.warn("[ProjectBacklogPage] Missing projectId after normalization, returning 404");
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
  const projectRole = mapRole(
    (membership?.role as ProjectRole | null) ?? null,
    user?.role ?? null
  );

  return (
    <BacklogPageClient
      project={project}
      projectRole={projectRole}
      currentUser={user}
    />
  );
}
