import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../../../lib/auth";
import prisma from "../../../../../../../lib/db";
import { sendEmail } from "../../../../../../../lib/email";
import { Role } from "../../../../../../../lib/prismaEnums";
import { resolveProjectId, type ProjectParams } from "../../../../../../../lib/params";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../../../lib/permissions";

const PROJECT_ADMIN_ROLES = [Role.ADMIN, Role.PO];

const validateEmail = (value: string) => /.+@.+\..+/i.test(value);

export async function POST(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
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
    include: { settings: true },
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

  const { email } = await request.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();

  if (!normalizedEmail || !validateEmail(normalizedEmail)) {
    return NextResponse.json(
      { message: "A valid recipient email is required." },
      { status: 400 }
    );
  }

  const settings = project.settings;

  if (!settings?.emailProvider) {
    return NextResponse.json(
      { message: "Configure an email provider before sending invites." },
      { status: 400 }
    );
  }

  const invite = await prisma.invitation.create({
    data: {
      email: normalizedEmail,
      token: randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      role: Role.VIEWER,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const appUrl =
    process.env.APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
  const inviteUrl = `${appUrl}/register?token=${invite.token}`;

  try {
    await sendEmail(
      {
        providerType: settings.emailProvider,
        fromName: settings.emailFromName,
        fromEmail: settings.emailFromAddress,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUsername: settings.smtpUsername,
        smtpPassword: settings.smtpPassword,
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
      },
      {
        to: normalizedEmail,
        subject: `${project.name} board invite`,
        text: `You have been invited to join ${project.name}. Use this link to get started: ${inviteUrl}`,
        html: `<p>You have been invited to join <strong>${project.name}</strong>.</p><p><a href="${inviteUrl}">Accept your invite</a> to get started.</p>`,
      }
    );
  } catch (error) {
    await prisma.invitation.delete({ where: { id: invite.id } });
    const message =
      error instanceof Error
        ? error.message
        : "Unable to send invite email. Please try again.";

    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({
    message: "Invite sent successfully",
    inviteUrl,
  });
}
