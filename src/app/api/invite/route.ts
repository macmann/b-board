import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { canManageProject } from "../../../lib/permissions";
import { getUserFromRequest } from "../../../lib/auth";
import prisma from "../../../lib/db";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { projectId, email } = await request.json();

  if (!projectId) {
    return NextResponse.json(
      { message: "Project ID is required." },
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

  const inviteToken = crypto.randomBytes(32).toString("hex");

  const invite = await prisma.inviteToken.create({
    data: {
      token: inviteToken,
      projectId: project.id,
      email: email ? String(email).trim().toLowerCase() : null,
    },
  });

  return NextResponse.json({ token: invite.token, projectId: invite.projectId });
}
