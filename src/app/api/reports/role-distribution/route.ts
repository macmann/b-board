import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { Role } from "@/lib/prismaEnums";

type RoleDistributionResponse = {
  totalMembers: number;
  projectCount: number;
  roles: Array<{
    role: Role;
    count: number;
    percentage: number;
  }>;
};

const getAccessibleProjectIds = async (
  user: { id: string; role: Role },
  requestedProjectId: string | null
) => {
  if (user.role === Role.ADMIN || user.role === Role.PO) {
    return requestedProjectId ? [requestedProjectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjects = memberships.map((membership) => membership.projectId);

  if (requestedProjectId) {
    return memberProjects.includes(requestedProjectId)
      ? [requestedProjectId]
      : ([] as string[]);
  }

  return memberProjects;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedProjectId = searchParams.get("projectId");
  const projectId = requestedProjectId === "all" ? null : requestedProjectId;

  const accessibleProjects = await getAccessibleProjectIds(user, projectId);

  if (Array.isArray(accessibleProjects) && accessibleProjects.length === 0) {
    return NextResponse.json({ ok: false, message: "No access to requested project" }, { status: 403 });
  }

  const membershipWhere = projectId
    ? { projectId }
    : accessibleProjects
      ? { projectId: { in: accessibleProjects } }
      : {};

  const memberships = await prisma.projectMember.findMany({
    where: membershipWhere,
    select: { role: true, projectId: true, userId: true },
  });

  const totalMembers = memberships.length;
  const projectCount = new Set(memberships.map((membership) => membership.projectId)).size;

  const roles = Object.values(Role).map((role) => {
    const count = memberships.filter((membership) => membership.role === role).length;
    const percentage = totalMembers > 0 ? count / totalMembers : 0;

    return { role, count, percentage };
  });

  const response: RoleDistributionResponse = {
    totalMembers,
    projectCount,
    roles,
  };

  return NextResponse.json(response);
}
