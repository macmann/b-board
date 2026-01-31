import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveAppUrl } from "../../../../../lib/appUrl";
import { Role } from "../../../../../lib/prismaEnums";

import { getUserFromRequest } from "../../../../../lib/auth";
import { getEmailErrorHint, sendEmail } from "../../../../../lib/email";
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
  const requestId = randomUUID();
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
      email: true,
      role: true,
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

  const settings = project.settings;

  if (!settings?.emailProvider) {
    return NextResponse.json(
      { message: "Configure an email provider before sending invites." },
      { status: 400 }
    );
  }

  if (!settings.emailFromAddress) {
    return NextResponse.json(
      { message: "A from email address is required to send invites." },
      { status: 400 }
    );
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
      return NextResponse.json(
        {
          message: "SMTP settings are incomplete.",
          hint: `Provide ${missing.join(", ")} to send email invites.`,
        },
        { status: 400 }
      );
    }
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
        text: `You have been invited to join ${project.name} as ${invitation.role}. Use this link to get started: ${inviteUrl}`,
        html: `<p>You have been invited to join <strong>${project.name}</strong> as <strong>${invitation.role}</strong>.</p><p><a href="${inviteUrl}">Accept your invite</a> to get started.</p>`,
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
  } catch (error) {
    await prisma.invitation.delete({ where: { id: invitation.id } });
    const hint = getEmailErrorHint(error) ?? undefined;
    const message =
      hint ||
      (error instanceof Error
        ? error.message
        : "Unable to send invite email. Please try again.");

    return NextResponse.json(
      { message, hint },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invitationId: invitation.id,
    token: invitation.token,
    inviteUrl,
  });
}
