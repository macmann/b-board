import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ForbiddenError,
  ensureProjectRole,
  PROJECT_ADMIN_ROLES,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";
import { AuditActorType, AuditEntityType } from "@/lib/prismaEnums";
import { logError } from "@/lib/logger";
import { safeLogAudit } from "@/lib/auditLogger";

type SettingsPayload = {
  backlogGroomingEnabled: boolean;
  model: string | null;
  temperature: number | null;
  projectBrief: string | null;
  proactiveGuidanceEnabled: boolean;
};

const parseModel = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseTemperature = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
    return NaN;
  }

  return parsed;
};

const mapResponse = (settings: SettingsPayload) => ({
  backlogGroomingEnabled: settings.backlogGroomingEnabled,
  model: settings.model ?? null,
  temperature: settings.temperature,
  projectBrief: settings.projectBrief,
  proactiveGuidanceEnabled: settings.proactiveGuidanceEnabled,
});

const parseProjectBrief = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

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

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const aiSettingsModel = (prisma as any).projectAISettings;
  const settings = aiSettingsModel?.findUnique
    ? await aiSettingsModel.findUnique({ where: { projectId } })
    : null;

  return NextResponse.json(
    mapResponse({
      backlogGroomingEnabled: settings?.backlogGroomingEnabled ?? false,
      model: settings?.model ?? process.env.AI_MODEL_DEFAULT ?? null,
      temperature: settings?.temperature ?? null,
      projectBrief: settings?.projectBrief ?? null,
      proactiveGuidanceEnabled: settings?.proactiveGuidanceEnabled ?? false,
    })
  );
}

export async function PUT(
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

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const aiSettingsModel = (prisma as any).projectAISettings;
  const existingSettings = aiSettingsModel?.findUnique
    ? await aiSettingsModel.findUnique({ where: { projectId } })
    : null;

  const body = await request.json();
  const { backlogGroomingEnabled, proactiveGuidanceEnabled } = body ?? {};

  if (typeof backlogGroomingEnabled !== "boolean" || typeof proactiveGuidanceEnabled !== "boolean") {
    return NextResponse.json(
      { message: "backlogGroomingEnabled and proactiveGuidanceEnabled must be provided as booleans" },
      { status: 400 }
    );
  }

  const model = parseModel(body?.model ?? null);
  const temperature = parseTemperature(body?.temperature ?? null);
  const projectBrief = parseProjectBrief(body?.projectBrief);

  if (Number.isNaN(temperature)) {
    return NextResponse.json(
      { message: "temperature must be between 0 and 2" },
      { status: 400 }
    );
  }

  if (!aiSettingsModel?.upsert) {
    return NextResponse.json({ message: "AI settings persistence is not available" }, { status: 503 });
  }

  const updated = await aiSettingsModel.upsert({
    where: { projectId },
    update: {
      backlogGroomingEnabled,
      model,
      temperature,
      projectBrief,
      proactiveGuidanceEnabled,
    },
    create: {
      projectId,
      backlogGroomingEnabled,
      model,
      temperature,
      projectBrief,
      proactiveGuidanceEnabled,
    },
  });

  const before: Partial<SettingsPayload> = existingSettings
    ? {
        backlogGroomingEnabled: existingSettings.backlogGroomingEnabled,
        model: existingSettings.model,
        temperature: existingSettings.temperature,
        projectBrief: existingSettings.projectBrief,
        proactiveGuidanceEnabled: existingSettings.proactiveGuidanceEnabled,
      }
    : {};

  const after: SettingsPayload = {
    backlogGroomingEnabled: updated.backlogGroomingEnabled,
    model: updated.model,
    temperature: updated.temperature,
    projectBrief: updated.projectBrief,
    proactiveGuidanceEnabled: updated.proactiveGuidanceEnabled,
  };

  try {
    await safeLogAudit({
      projectId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      action: "PROJECT_AI_SETTINGS_UPDATED",
      entityType: AuditEntityType.SETTINGS,
      entityId: updated.id,
      summary: "AI settings updated",
      before,
      after,
    });
  } catch (error) {
    logError("Failed to record audit log for AI settings update", error);
  }

  return NextResponse.json(mapResponse(after));
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  return PUT(request, { params: Promise.resolve(params) });
}
