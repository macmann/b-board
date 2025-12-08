import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../lib/auth";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../lib/permissions";
import prisma from "../../../../lib/db";
import { Role } from "../../../../lib/prismaEnums";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ invitationId: string }> }
) {
  const { invitationId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
    select: { id: true, projectId: true, acceptedAt: true },
  });

  if (!invitation) {
    return NextResponse.json({ message: "Invitation not found" }, { status: 404 });
  }

  try {
    await requireProjectRole(user.id, invitation.projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { message: "Invitation has already been accepted" },
      { status: 400 }
    );
  }

  await prisma.invitation.delete({ where: { id: invitation.id } });

  return NextResponse.json({ success: true });
}
