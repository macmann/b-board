import prisma from "./db";
import { logError } from "./logger";
import { AuditActorType, AuditEntityType } from "./prismaEnums";
import { getRequestContext } from "./requestContext";

const MAX_JSON_LENGTH = 4000;

export type AuditLogInput = {
  projectId?: string | null;
  actorType: (typeof AuditActorType)[keyof typeof AuditActorType];
  actorId?: string | null;
  action: string;
  entityType: (typeof AuditEntityType)[keyof typeof AuditEntityType];
  entityId?: string | null;
  summary: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

const sanitizeJson = (value: unknown) => {
  if (value === undefined) return undefined;

  try {
    const jsonString = JSON.stringify(value);
    if (jsonString.length <= MAX_JSON_LENGTH) {
      return value as any;
    }

    return {
      truncated: true,
      preview: jsonString.slice(0, MAX_JSON_LENGTH),
    };
  } catch (error) {
    return {
      truncated: true,
      error: "Unable to serialize payload",
    };
  }
};

export async function logAudit(input: AuditLogInput): Promise<void> {
  const context = getRequestContext();

  const baseMetadata: Record<string, unknown> = {
    ...(input.metadata ?? {}),
  };

  if (context?.requestId) baseMetadata.requestId = context.requestId;
  if (context?.ip) baseMetadata.ip = context.ip;
  if (context?.userAgent) baseMetadata.userAgent = context.userAgent;

  const payload = {
    projectId: input.projectId ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? context?.userId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    summary: input.summary,
    before: sanitizeJson(input.before) as any,
    after: sanitizeJson(input.after) as any,
    metadata: sanitizeJson(baseMetadata) as any,
  };

  queueMicrotask(() => {
    prisma.auditLog
      .create({ data: payload })
      .catch((error) => logError("Failed to write audit log", error));
  });
}

export async function safeLogAudit(input: AuditLogInput): Promise<void> {
  try {
    await logAudit(input);
  } catch (error) {
    logError("Failed to queue audit log", error);
  }
}

export async function logAiRunStarted(params: {
  projectId?: string | null;
  aiRunId: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}) {
  await safeLogAudit({
    projectId: params.projectId ?? null,
    actorType: AuditActorType.AI,
    actorId: params.aiRunId,
    action: "AI_RUN_STARTED",
    entityType: AuditEntityType.AI_RUN,
    entityId: params.aiRunId,
    summary: params.summary ?? "AI run started",
    metadata: params.metadata,
  });
}

export async function logAiSuggestionEvent(params: {
  projectId?: string | null;
  aiRunId?: string | null;
  suggestionId: string;
  action: "AI_SUGGESTION_ACCEPTED" | "AI_SUGGESTION_REJECTED" | "AI_SUGGESTION_APPLIED";
  summary: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}) {
  await safeLogAudit({
    projectId: params.projectId ?? null,
    actorType: AuditActorType.AI,
    actorId: params.aiRunId ?? null,
    action: params.action,
    entityType: AuditEntityType.AI_SUGGESTION,
    entityId: params.suggestionId,
    summary: params.summary,
    before: params.before,
    after: params.after,
    metadata: params.metadata,
  });
}
