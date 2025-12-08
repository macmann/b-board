import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { Role } from "../../../lib/prismaEnums";

import { getUserFromRequest } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { canManageProject } from "../../../lib/permissions";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { projectId, email, role } = await request.json();

  if (!projectId || !email) {
    return NextResponse.json(
      { message: "Project ID and email are required." },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    return NextResponse.json({ message: "Project not found." }, { status: 404 });
  }

  const isAllowed = await canManageProject(user, projectId);

  if (!isAllowed) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const parsedRole = Object.values(Role).includes(role as Role)
    ? (role as Role)
    : Role.VIEWER;
  const inviteToken = crypto.randomBytes(32).toString("hex");

  const invite = await prisma.invitation.create({
    data: {
      token: inviteToken,
      email: normalizedEmail,
      workspaceId: project.workspaceId,
      projectId: project.id,
      invitedById: user.id,
      role: parsedRole,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({ token: invite.token, projectId: invite.projectId });
}
