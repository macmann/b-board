import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { resolveAppUrl } from "@/lib/appUrl";
import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { getEmailErrorHint, sendEmail } from "@/lib/email";
import { Role } from "@/lib/prismaEnums";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";

const PROJECT_ADMIN_ROLES = [Role.ADMIN, Role.PO];

const validateEmail = (value: string) => /.+@.+\..+/i.test(value);

export async function POST(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
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

  try {
    log("info", "Send invite request received", {
      route: request.nextUrl.pathname,
    });

    const projectId = await resolveProjectId(params);

    if (!projectId) {
      return respond(400, { message: "projectId is required" });
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return respond(401, { message: "Unauthorized" });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { settings: true },
    });

    if (!project) {
      return respond(404, { message: "Project not found" });
    }

    try {
      await requireProjectRole(user.id, projectId, PROJECT_ADMIN_ROLES);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return respond(error.status, { message: error.message });
      }

      return respond(403, { message: "Forbidden" });
    }

    let normalizedEmail = "";
    try {
      const { email } = await request.json();
      normalizedEmail = String(email ?? "").trim().toLowerCase();
    } catch (error) {
      log("error", "Failed to parse invite request body", { error });
      return respond(400, { message: "Invalid request body." });
    }

    log("info", "Invite request parsed", {
      email: normalizedEmail,
    });

    if (!normalizedEmail || !validateEmail(normalizedEmail)) {
      return respond(400, { message: "A valid recipient email is required." });
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
        message: "Configure an email provider before sending invites.",
      });
    }

    if (!settings.emailFromAddress) {
      return respond(400, {
        message: "A from email address is required to send invites.",
      });
    }

    const isSmtpProvider =
      settings.emailProvider === "SMTP" ||
      settings.emailProvider === "MS365" ||
      settings.emailProvider === "GOOGLE_MAIL";

    if (isSmtpProvider) {
      const missing: string[] = [];
      if (!settings.smtpHost) missing.push("SMTP host");
      if (!settings.smtpPort) missing.push("SMTP port");
      if (!settings.smtpUsername) missing.push("SMTP username");
      if (!settings.smtpPassword) missing.push("SMTP password");

      if (missing.length) {
        return respond(400, {
          message: "SMTP settings are incomplete.",
          hint: `Provide ${missing.join(", ")} to send email invites.`,
        });
      }
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

    let appUrl = "";
    try {
      appUrl = resolveAppUrl(request);
    } catch (error) {
      log("error", "Failed to resolve APP_URL for invite", {
        error: error instanceof Error ? error.message : error,
      });
      await prisma.invitation.delete({ where: { id: invite.id } });
      return respond(500, {
        message: "Unable to generate invite link.",
        hint: "Configure APP_URL to send invites.",
      });
    }

    const inviteUrl = `${appUrl}/register?token=${invite.token}`;

    log("info", "Attempting to send invite email", {
      email: normalizedEmail,
      inviteId: invite.id,
      inviteUrl,
    });

    try {
      const result = await sendEmail(
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

      log("info", "Invite email sent", {
        messageId: result.messageId,
        response: result.response,
      });
    } catch (error) {
      await prisma.invitation.delete({ where: { id: invite.id } });

      const hint = getEmailErrorHint(error) ?? undefined;
      const message =
        hint ||
        (error instanceof Error
          ? error.message
          : "Unable to send invite email. Please try again.");

      log("error", "Failed to send invite email", {
        error: error instanceof Error ? error.stack : error,
        hint,
      });

      return respond(500, {
        message,
        hint,
      });
    }

    return respond(200, {
      message: "Invite sent successfully",
      inviteUrl,
    });
  } catch (error) {
    log("error", "Unhandled error while sending invite", {
      error: error instanceof Error ? error.stack : error,
    });

    return respond(500, {
      message: "Unable to send invite right now. Please try again later.",
      hint: "Contact support with the request ID for assistance.",
    });
  }
}
