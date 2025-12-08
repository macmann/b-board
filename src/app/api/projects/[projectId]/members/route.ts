import { NextRequest, NextResponse } from "next/server";
import { Role } from "../../../../../lib/prismaEnums";

import { getUserFromRequest } from "../../../../../lib/auth";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import prisma from "../../../../../lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  try {
    await requireProjectRole(user.id, projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireProjectRole(user.id, projectId, [Role.ADMIN]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { userId, role } = await request.json();

  if (!userId || !role) {
    return NextResponse.json(
      { message: "userId and role are required" },
      { status: 400 }
    );
  }

  const parsedRole = Object.values(Role).includes(role as Role)
    ? (role as Role)
    : Role.VIEWER;

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });

  if (!targetUser) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const existingMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: { projectId, userId },
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
      projectId,
      userId,
      role: parsedRole,
    },
  });

  return NextResponse.json(membership, { status: 201 });
}
