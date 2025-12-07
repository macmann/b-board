import { NextRequest, NextResponse } from "next/server";
import { ProjectMemberRole } from "@prisma/client";

import { requireProjectRole } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

const ALL_PROJECT_ROLES = [
  ProjectMemberRole.ADMIN,
  ProjectMemberRole.PO,
  ProjectMemberRole.DEV,
  ProjectMemberRole.QA,
  ProjectMemberRole.VIEWER,
];

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const authResult = await requireProjectRole(
    request,
    params.projectId,
    ALL_PROJECT_ROLES
  );

  if ("error" in authResult) {
    return authResult.error;
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: params.projectId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const authResult = await requireProjectRole(request, params.projectId, [
    ProjectMemberRole.ADMIN,
  ]);

  if ("error" in authResult) {
    return authResult.error;
  }

  const { userId, role } = await request.json();

  if (!userId || !role) {
    return NextResponse.json(
      { message: "userId and role are required" },
      { status: 400 }
    );
  }

  const parsedRole = Object.values(ProjectMemberRole).includes(
    role as ProjectMemberRole
  )
    ? (role as ProjectMemberRole)
    : ProjectMemberRole.VIEWER;

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!targetUser) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const existingMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId: params.projectId, userId },
    },
  });

  if (existingMembership) {
    return NextResponse.json(
      { message: "User is already a project member" },
      { status: 409 }
    );
  }

  const membership = await prisma.projectMember.create({
    data: {
      projectId: params.projectId,
      userId,
      role: parsedRole,
    },
  });

  return NextResponse.json(membership, { status: 201 });
}
