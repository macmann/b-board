import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";

import { Role } from "./prismaEnums";

import { getUserFromRequest } from "./auth";
import prisma from "./db";

export type ProjectContext = {
  project: Project | null;
  membership: ProjectMember | null;
  user: User | null;
};

type Project = { id: string; name: string };
type ProjectMember = { projectId: string; userId: string; role: Role };
type User = { id: string; role: Role; name?: string | null; email?: string };

export const getCurrentProjectContext = async (
  projectId: string | undefined
): Promise<ProjectContext> => {
  if (!projectId) {
    throw new Error("getCurrentProjectContext called without projectId");
  }

  const headerList = await headers();
  const cookieStore = await cookies();

  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const url = `${protocol}://${host}${headerList.get("x-invoke-path") ?? "/"}`;

  const request = new NextRequest(url, {
    headers: new Headers(headerList),
  });

  cookieStore.getAll().forEach((cookie) => {
    request.cookies.set(cookie.name, cookie.value);
  });

  const user = await getUserFromRequest(request);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  let membership: ProjectMember | null = null;

  if (user) {
    membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: user.id },
      },
    });
  }

  return { project, membership, user };
};
