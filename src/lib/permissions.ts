import { Role, User, UserRole } from "@prisma/client";

import prisma from "./db";

export class AuthorizationError extends Error {
  status: number;

  constructor(message = "Forbidden", status = 403) {
    super(message);
    this.status = status;
  }
}

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

export const requireProjectRole = async (
  userId: string,
  projectId: string,
  roles: Role[]
): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new AuthorizationError("Unauthorized", 401);
  }

  if (user.role === Role.ADMIN) return;

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });

  if (!membership || !roles.includes(membership.role)) {
    throw new AuthorizationError();
  }
};
