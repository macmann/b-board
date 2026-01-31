import { NextRequest, NextResponse } from "next/server";

import { resolveAppUrl } from "@/lib/appUrl";
import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { getEmailErrorHint, sendEmail } from "@/lib/email";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";
import { Role } from "@/lib/prismaEnums";

const PROJECT_ADMIN_ROLES = [Role.ADMIN, Role.PO];

export async function POST(
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { settings: true },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, projectId, acceptedAt: null },
  });

  if (!invitation) {
    return NextResponse.json(
      { message: "Invitation not found." },
      { status: 404 }
    );
  }

  const settings = project.settings;

  if (!settings?.emailProvider) {
    return NextResponse.json(
      { message: "Configure an email provider before resending invites." },
      { status: 400 }
    );
  }

  if (!settings.emailFromAddress) {
    return NextResponse.json(
      { message: "A from email address is required to resend invites." },
      { status: 400 }
    );
  }

  let inviteUrl = "";
  try {
    inviteUrl = `${resolveAppUrl(request)}/register?token=${invitation.token}`;
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to resolve application URL.",
      },
      { status: 500 }
    );
  }

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
        to: invitation.email,
        subject: `${project.name} board invite`,
        text: `You have been invited to join ${project.name}. Use this link to get started: ${inviteUrl}`,
        html: `<p>You have been invited to join <strong>${project.name}</strong>.</p><p><a href="${inviteUrl}">Accept your invite</a> to get started.</p>`,
      },
      {
        enableVerify: true,
        transportTimeouts: {
          connection: 12_000,
          greeting: 12_000,
          socket: 25_000,
        },
      }
    );
  } catch (error) {
    const hint = getEmailErrorHint(error) ?? undefined;
    const message =
      hint ||
      (error instanceof Error
        ? error.message
        : "Unable to resend invite email. Please try again.");

    return NextResponse.json(
      { message, hint },
      { status: 500 }
    );
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return NextResponse.json({
    message: "Invitation resent successfully.",
    inviteUrl,
  });
}
