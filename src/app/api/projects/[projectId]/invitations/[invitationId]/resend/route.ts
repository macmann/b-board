import { randomUUID } from "crypto";
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
  const requestId = randomUUID();
  const respond = (status: number, body: Record<string, unknown>) =>
    NextResponse.json(
      {
        ok: status >= 200 && status < 300,
        requestId,
        ...body,
      },
      { status }
    );
  const log = (
    level: "info" | "error",
    message: string,
    meta?: Record<string, unknown>
  ) => {
    const payload = {
      level,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    const logger = level === "error" ? console.error : console.info;
    logger(payload);
  };
  const projectId = await resolveProjectId(params);
  const invitationId = params.invitationId;

  if (!projectId || !invitationId) {
    return respond(400, { message: "projectId and invitationId are required" });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return respond(401, { message: "Unauthorized" });
  }

  log("info", "Resend invite request received", {
    route: request.nextUrl.pathname,
    projectId,
    invitationId,
  });

  try {
    await requireProjectRole(user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return respond(error.status, { message: error.message });
    }

    return respond(403, { message: "Forbidden" });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { settings: true },
  });

  if (!project) {
    return respond(404, { message: "Project not found" });
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, projectId, acceptedAt: null },
  });

  if (!invitation) {
    return respond(404, { message: "Invitation not found." });
  }

  const settings = project.settings;

  log("info", "Email settings loaded", {
    provider: settings?.emailProvider,
    fromEmail: settings?.emailFromAddress,
    smtpHost: settings?.smtpHost,
    smtpPort: settings?.smtpPort,
    smtpUsername: settings?.smtpUsername,
  });

  if (!settings?.emailProvider) {
    return respond(400, {
      message: "Configure an email provider before resending invites.",
    });
  }

  if (!settings.emailFromAddress) {
    return respond(400, {
      message: "A from email address is required to resend invites.",
    });
  }

  let inviteUrl = "";
  try {
    inviteUrl = `${resolveAppUrl(request)}/register?token=${invitation.token}`;
  } catch (error) {
    return respond(500, {
      message:
        error instanceof Error
          ? error.message
          : "Unable to resolve application URL.",
    });
  }

  log("info", "Attempting to resend invite email", {
    email: invitation.email,
    inviteId: invitation.id,
    inviteUrl,
  });

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
        requestId,
        enableVerify: true,
        transportTimeouts: {
          connection: 12_000,
          greeting: 12_000,
          socket: 25_000,
        },
      }
    );
    log("info", "Invite email resent", {
      email: invitation.email,
      inviteId: invitation.id,
    });
  } catch (error) {
    const hint = getEmailErrorHint(error) ?? undefined;
    const message =
      hint ||
      (error instanceof Error
        ? error.message
        : "Unable to resend invite email. Please try again.");

    log("error", "Failed to resend invite email", {
      error: error instanceof Error ? error.stack : error,
      hint,
    });

    return respond(500, { message, hint });
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: {
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return respond(200, {
    message: "Invitation resent successfully.",
    inviteUrl,
  });
}
