import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveAppUrl } from "../../../../../lib/appUrl";
import { Role } from "../../../../../lib/prismaEnums";

import { getUserFromRequest } from "../../../../../lib/auth";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import prisma from "../../../../../lib/db";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";

const PROJECT_ADMIN_ROLES = [Role.ADMIN, Role.PO];

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

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
    await requireProjectRole(user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const invitations = await prisma.invitation.findMany({
    where: {
      projectId,
      acceptedAt: null,
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, workspaceId: true },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  try {
    await requireProjectRole(user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { email, role } = await request.json();

  if (!email || !role) {
    return NextResponse.json(
      { message: "email and role are required" },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const parsedRole = Object.values(Role).includes(role as Role)
    ? (role as Role)
    : null;

  if (!parsedRole) {
    return NextResponse.json({ message: "Invalid role" }, { status: 400 });
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      token,
      workspaceId: project.workspaceId,
      projectId: project.id,
      role: parsedRole,
      invitedById: user.id,
      expiresAt,
    },
    select: {
      id: true,
      token: true,
    },
  });

  let appUrl: string;
  try {
    appUrl = resolveAppUrl(request);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to resolve application URL.";
    return NextResponse.json({ message }, { status: 500 });
  }

  const inviteUrl = `${appUrl}/register?token=${invitation.token}`;

  return NextResponse.json({
    invitationId: invitation.id,
    token: invitation.token,
    inviteUrl,
  });
}
