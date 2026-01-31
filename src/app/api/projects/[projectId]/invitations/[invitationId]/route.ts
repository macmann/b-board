import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";
import { AuthorizationError, requireProjectRole } from "../../../../../lib/permissions";
import { Role } from "../../../../../lib/prismaEnums";

const PROJECT_ADMIN_ROLES = [Role.ADMIN, Role.PO];

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams> & { invitationId: string }> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);
  const invitationId = params.invitationId;

  if (!projectId || !invitationId) {
    return NextResponse.json(
      { message: "projectId and invitationId are required" },
      { status: 400 }
    );
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
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

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, projectId },
    select: { id: true, acceptedAt: true },
  });

  if (!invitation) {
    return NextResponse.json(
      { message: "Invitation not found" },
      { status: 404 }
    );
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { message: "Invitation has already been accepted." },
      { status: 400 }
    );
  }

  await prisma.invitation.delete({ where: { id: invitation.id } });

  return NextResponse.json({ message: "Invitation deleted." });
}
