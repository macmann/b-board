import { Role, User, UserRole } from "@prisma/client";

import prisma from "./db";

export const requireRole = async (
  user: User | null,
  allowedRoles: UserRole[]
): Promise<boolean> => {
  if (!user) return false;

  return allowedRoles.includes(user.role);
};

export const canManageProject = async (
  user: User | null,
  projectId: string
): Promise<boolean> => {
  if (!user) return false;

  if (user.role === UserRole.ADMIN) return true;

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId: user.id },
    },
  });

  if (!membership) return false;

  return [Role.ADMIN, Role.PO].includes(membership.role);
};

export const canModifyIssue = async (
  user: User | null,
  issueId: string
): Promise<boolean> => {
  if (!user) return false;

  if (user.role === UserRole.ADMIN) return true;

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true },
  });

  if (!issue) return false;

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: issue.projectId, userId: user.id },
    },
  });

  if (!membership) return false;

  return [Role.ADMIN, Role.PO, Role.DEV, Role.QA].includes(membership.role);
};
