import prisma from "../db";
import { AuthorizationError } from "../permissions";
import { Role } from "../prismaEnums";

export const requireWorkspaceAccess = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  if (user.role === Role.ADMIN) return;

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!membership) {
    throw new AuthorizationError();
  }
};

export const getAccessibleProjects = async (
  userId: string,
  projectId?: string | null
): Promise<string[]> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  if (user.role === Role.ADMIN) {
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!project) {
        throw new AuthorizationError("Project not found", 404);
      }

      return [project.id];
    }

    const allProjects = await prisma.project.findMany({ select: { id: true } });
    return allProjects.map((project) => project.id);
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });

  const memberProjectIds = memberships.map((membership) => membership.projectId);

  if (projectId) {
    if (!memberProjectIds.includes(projectId)) {
      throw new AuthorizationError();
    }

    return memberProjectIds.filter((id) => id === projectId);
  }

  return memberProjectIds;
};
