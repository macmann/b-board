import { PrismaClient } from "@prisma/client";
import { Role, UserRole } from "./prismaEnums";

type User = {
  id: string;
  role: Role;
};

type ProjectMember = {
  role: Role;
};

import prisma from "./db";
import {
  GlobalRole,
  ProjectRole,
  PROJECT_ADMIN_ROLES,
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "./roles";

export { PROJECT_ADMIN_ROLES, PROJECT_CONTRIBUTOR_ROLES, PROJECT_VIEWER_ROLES };

export class ForbiddenError extends Error {
  statusCode = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const getProjectMembership = async (
  prismaClient: PrismaClient,
  userId: string,
  projectId: string
): Promise<ProjectMember | null> => {
  return prismaClient.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
    },
  });
};

export const ensureGlobalRole = (
  user: User | null,
  allowedRoles: GlobalRole[]
) => {
  if (!user || !allowedRoles.includes(user.role as GlobalRole)) {
    throw new ForbiddenError();
  }
};

export const ensureProjectRole = async (
  prismaClient: PrismaClient,
  userId: string,
  projectId: string,
  allowedRoles: ProjectRole[]
) => {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user) {
    throw new ForbiddenError();
  }

  if (user.role === "ADMIN") {
    return;
  }

  const membership = await getProjectMembership(prismaClient, userId, projectId);

  if (!membership || !allowedRoles.includes(membership.role as ProjectRole)) {
    throw new ForbiddenError();
  }
};

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

  return membership.role === Role.ADMIN || membership.role === Role.PO;
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
