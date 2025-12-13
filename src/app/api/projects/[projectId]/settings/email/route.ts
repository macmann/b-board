import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../../lib/auth";
import prisma from "../../../../../../lib/db";
import { EmailProviderType } from "../../../../../../lib/prismaEnums";
import { resolveProjectId, type ProjectParams } from "../../../../../../lib/params";
import {
  ForbiddenError,
  ensureProjectRole,
  PROJECT_ADMIN_ROLES,
} from "../../../../../../lib/permissions";

const EMAIL_REGEX = /.+@.+\..+/i;

const mapResponse = (settings: {
  emailProvider: keyof typeof EmailProviderType | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUsername: string | null;
  smtpPassword: string | null;
  apiUrl: string | null;
  apiKey: string | null;
}) => ({
  providerType: settings.emailProvider ?? null,
  fromName: settings.emailFromName ?? "",
  fromEmail: settings.emailFromAddress ?? "",
  smtpHost: settings.smtpHost ?? "",
  smtpPort: settings.smtpPort,
  smtpUsername: settings.smtpUsername ?? "",
  apiUrl: settings.apiUrl ?? "",
  hasSmtpPassword: Boolean(settings.smtpPassword),
  hasApiKey: Boolean(settings.apiKey),
});

const parseProviderType = (value: unknown):
  | keyof typeof EmailProviderType
  | null => {
  if (value === null) return null;
  if (value === EmailProviderType.SMTP) return EmailProviderType.SMTP;
  if (value === EmailProviderType.API) return EmailProviderType.API;
  return null;
};

const ensureValidBody = (body: any) => {
  const providerType = parseProviderType(body?.providerType);
  const fromEmail = body?.fromEmail ? String(body.fromEmail).trim() : "";
  const fromName = body?.fromName ? String(body.fromName).trim() : "";
  const smtpHost = body?.smtpHost ? String(body.smtpHost).trim() : "";
  const smtpPort =
    typeof body?.smtpPort === "number"
      ? body.smtpPort
      : Number.parseInt(body?.smtpPort ?? "", 10);
  const smtpUsername = body?.smtpUsername ? String(body.smtpUsername).trim() : "";
  const smtpPassword = body?.smtpPassword
    ? String(body.smtpPassword).trim()
    : "";
  const apiUrl = body?.apiUrl ? String(body.apiUrl).trim() : "";
  const apiKey = body?.apiKey ? String(body.apiKey).trim() : "";

  if (providerType && !fromEmail) {
    throw new Error("From email is required when email is enabled.");
  }

  if (fromEmail && !EMAIL_REGEX.test(fromEmail)) {
    throw new Error("From email must be a valid email address.");
  }

  if (providerType === EmailProviderType.SMTP) {
    if (!smtpHost) {
      throw new Error("SMTP host is required for SMTP provider.");
    }
    if (!smtpPort || Number.isNaN(smtpPort) || smtpPort <= 0) {
      throw new Error("SMTP port must be a positive number.");
    }
  }

  if (providerType === EmailProviderType.API) {
    if (!apiUrl) {
      throw new Error("API URL is required for API provider.");
    }
  }

  return {
    providerType,
    fromEmail,
    fromName,
    smtpHost,
    smtpPort: Number.isNaN(smtpPort) ? null : smtpPort,
    smtpUsername,
    smtpPassword,
    apiUrl,
    apiKey,
  };
};

export async function GET(
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

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
  });

  if (!settings) {
    return NextResponse.json(
      mapResponse({
        emailProvider: null,
        emailFromName: "",
        emailFromAddress: "",
        smtpHost: "",
        smtpPort: null,
        smtpUsername: "",
        smtpPassword: "",
        apiUrl: "",
        apiKey: "",
      })
    );
  }

  return NextResponse.json(mapResponse(settings));
}

export async function PUT(
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

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const currentSettings = await prisma.projectSettings.findUnique({
    where: { projectId },
  });

  let parsedSettings;
  try {
    parsedSettings = ensureValidBody(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ message }, { status: 400 });
  }

  const emailProvider = parsedSettings.providerType;

  const smtpPassword = parsedSettings.smtpPassword
    ? parsedSettings.smtpPassword
    : currentSettings?.smtpPassword ?? null;

  const apiKey = parsedSettings.apiKey
    ? parsedSettings.apiKey
    : currentSettings?.apiKey ?? null;

  if (emailProvider === EmailProviderType.SMTP && !smtpPassword) {
    return NextResponse.json(
      { message: "SMTP password is required for SMTP provider." },
      { status: 400 }
    );
  }

  if (emailProvider === EmailProviderType.API && !apiKey) {
    return NextResponse.json(
      { message: "API key is required for API provider." },
      { status: 400 }
    );
  }

  const updated = await prisma.projectSettings.upsert({
    where: { projectId },
    update: {
      emailProvider,
      emailFromName: parsedSettings.fromName || null,
      emailFromAddress: parsedSettings.fromEmail || null,
      smtpHost: parsedSettings.smtpHost || null,
      smtpPort: parsedSettings.smtpPort || null,
      smtpUsername: parsedSettings.smtpUsername || null,
      smtpPassword,
      apiUrl: parsedSettings.apiUrl || null,
      apiKey,
    },
    create: {
      projectId,
      emailProvider,
      emailFromName: parsedSettings.fromName || null,
      emailFromAddress: parsedSettings.fromEmail || null,
      smtpHost: parsedSettings.smtpHost || null,
      smtpPort: parsedSettings.smtpPort || null,
      smtpUsername: parsedSettings.smtpUsername || null,
      smtpPassword,
      apiUrl: parsedSettings.apiUrl || null,
      apiKey,
    },
  });

  return NextResponse.json(mapResponse(updated));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  return PUT(request, { params });
}
