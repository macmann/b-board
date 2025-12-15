import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { jsonError } from "@/lib/apiResponse";
import { safeLogAudit } from "@/lib/auditLogger";
import { chatJson } from "@/lib/ai/aiClient";
import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
} from "@/lib/permissions";
import { toInputJsonValue } from "@/lib/prisma/json";
import {
  AIRunStatus,
  AISuggestionStatus,
  AISuggestionTargetType,
  AuditActorType,
  AuditEntityType,
  FeatureType,
  IssuePriority,
  IssueStatus,
  IssueType,
} from "@/lib/prismaEnums";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;
const DESCRIPTION_PREVIEW_LENGTH = 1200;
const DEDUP_WINDOW_DAYS = 7;
const SUGGESTION_TYPE = "INCOMPLETE_STORY_FLAG";

type IssueSummary = {
  issueId: string;
  key: string | null;
  title: string;
  description: string;
  labels: string[];
  priority: IssuePriority;
  type: IssueType;
  status: IssueStatus;
};

const aiResponseSchema = z.object({
  flagged: z.array(
    z.object({
      issueId: z.string(),
      flags: z.array(
        z.object({
          code: z.enum(["MISSING_DESCRIPTION", "MISSING_AC", "TOO_VAGUE", "NEEDS_CONTEXT"]),
          title: z.string(),
          rationaleBullets: z.array(z.string()),
          confidence: z.number(),
        })
      ),
    })
  ),
});

function truncate(text: string | null | undefined, maxLength: number) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

async function fetchIssues(projectId: string, limit: number) {
  const issues = await prisma.issue.findMany({
    where: {
      projectId,
      sprintId: null,
      status: { not: IssueStatus.DONE },
      type: IssueType.STORY,
    },
    orderBy: [
      { priority: "desc" },
      { updatedAt: "desc" },
    ],
    take: limit,
  });

  return issues.map<IssueSummary>((issue) => ({
    issueId: issue.id,
    key: issue.key ?? null,
    title: issue.title,
    description: truncate(issue.description, DESCRIPTION_PREVIEW_LENGTH),
    labels: [],
    priority: issue.priority,
    type: issue.type,
    status: issue.status,
  }));
}

function buildPrompt(options: {
  projectName: string;
  projectBrief?: string | null;
  issues: IssueSummary[];
}) {
  const schema = `{
  "flagged": [
    {
      "issueId": "string",
      "flags": [
        {
          "code": "MISSING_DESCRIPTION"|"MISSING_AC"|"TOO_VAGUE"|"NEEDS_CONTEXT",
          "title": "string",
          "rationaleBullets": ["string"],
          "confidence": 0.0
        }
      ]
    }
  ]
}`;

  const brief = options.projectBrief?.trim() || "No project brief provided.";

  const instructions = [
    "You are assisting with agile backlog grooming. Only output issues that are incomplete.",
    "Hard rules for incomplete: missing description, missing acceptance criteria section, or description too vague/not user-story shaped.",
    "Use NEEDS_CONTEXT when the story lacks domain context or key details to write acceptance criteria even if text exists.",
    "If an issue looks complete, do not include it in the output.",
    "Respond strictly with JSON matching the schema and nothing else.",
  ].join("\n");

  const payload = {
    project: {
      name: options.projectName,
      brief,
    },
    issues: options.issues,
  };

  return {
    system: "You are a precise JSON generator for backlog grooming.",
    user: `${instructions}\nSchema:${schema}\nIssues:${JSON.stringify(payload, null, 2)}`,
    snapshot: payload,
  };
}

export async function POST(request: NextRequest, { params }: { params: ProjectParams }) {
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    setRequestContextUser(user.id, [user.role]);

    try {
      await ensureProjectRole(prisma, user.id, projectId, PROJECT_CONTRIBUTOR_ROLES);
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return jsonError("Forbidden", 403);
      }
      throw error;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      return jsonError("Project not found", 404);
    }

    const settings = await prisma.projectAISettings.findUnique({ where: { projectId } });

    if (!settings?.backlogGroomingEnabled) {
      return jsonError("Backlog grooming AI is not enabled for this project", 409);
    }

    const body = await request.json().catch(() => ({}));

    const limitInput = Number(body.limit ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(limitInput)
      ? Math.min(Math.max(1, Math.floor(limitInput)), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const issues = await fetchIssues(projectId, limit);

    if (issues.length === 0) {
      return jsonError("No issues found to scan", 404);
    }

    const { system, user: userPrompt, snapshot } = buildPrompt({
      projectName: project.name,
      projectBrief: settings.projectBrief,
      issues,
    });

    const aiRun = await prisma.aIRun.create({
      data: {
        projectId,
        featureType: FeatureType.BACKLOG_GROOMING,
        status: AIRunStatus.STARTED,
        createdByUserId: user.id,
        inputSnapshot: toInputJsonValue(snapshot),
      },
    });

    await safeLogAudit({
      projectId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      action: "AI_GROOMING_SCAN_TRIGGERED",
      entityType: AuditEntityType.AI_RUN,
      entityId: aiRun.id,
      summary: "Backlog grooming scan requested",
    }).catch((error) => logError("Failed to write grooming scan audit log", error));

    try {
      const aiResultUnknown = await chatJson({
        model: settings.model ?? undefined,
        temperature: settings.temperature ?? undefined,
        system,
        user: userPrompt,
      });

      let parsed: z.infer<typeof aiResponseSchema>;

      try {
        parsed = aiResponseSchema.parse(aiResultUnknown);
      } catch (error) {
        await prisma.aIRun.update({
          where: { id: aiRun.id },
          data: {
            status: AIRunStatus.FAILED,
            finishedAt: new Date(),
            outputRaw: toInputJsonValue(aiResultUnknown),
            errorMessage: "AI response failed schema validation",
          },
        });

        await safeLogAudit({
          projectId,
          actorType: AuditActorType.AI,
          actorId: aiRun.id,
          action: "AI_RUN_FAILED",
          entityType: AuditEntityType.AI_RUN,
          entityId: aiRun.id,
          summary: "AI grooming scan failed validation",
          metadata: error instanceof z.ZodError ? { zodErrors: error.flatten() } : undefined,
        }).catch((auditError) => logError("Failed to audit AI scan failure", auditError));

        return jsonError("AI response validation failed", 500);
      }

      const issueIdLookup = issues.reduce((lookup, issue) => {
        lookup.set(issue.issueId, issue.issueId);
        if (issue.key) {
          lookup.set(issue.key, issue.issueId);
        }
        return lookup;
      }, new Map<string, string>());

      const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const targetIds = Array.from(new Set(parsed.flagged.map((issue) => issueIdLookup.get(issue.issueId)).filter(Boolean)));

      const existing = await prisma.aISuggestion.findMany({
        where: {
          projectId,
          targetType: AISuggestionTargetType.ISSUE,
          targetId: { in: targetIds as string[] },
          suggestionType: SUGGESTION_TYPE,
          status: AISuggestionStatus.PROPOSED,
          createdAt: { gte: dedupCutoff },
        },
      });

      const existingIndex = new Set(
        existing
          .map((suggestion) => {
            const payload = suggestion.payload as { code?: string } | null;
            return payload?.code ? `${suggestion.targetId}:${payload.code}` : null;
          })
          .filter((value): value is string => Boolean(value))
      );

      const suggestionsToCreate = parsed.flagged.flatMap(({ issueId, flags }) => {
        const resolvedId = issueIdLookup.get(issueId);
        if (!resolvedId) return [] as Array<{ targetId: string; flag: (typeof flags)[number] }>;

        return flags.map((flag) => ({ targetId: resolvedId, flag }));
      });

      const newSuggestions = suggestionsToCreate.filter(({ targetId, flag }) => {
        const key = `${targetId}:${flag.code}`;
        if (existingIndex.has(key)) return false;
        existingIndex.add(key);
        return true;
      });

      await prisma.$transaction(async (tx) => {
        if (newSuggestions.length > 0) {
          await tx.aISuggestion.createMany({
            data: newSuggestions.map(({ targetId, flag }) => ({
              projectId,
              featureType: FeatureType.BACKLOG_GROOMING,
              targetType: AISuggestionTargetType.ISSUE,
              targetId,
              suggestionType: SUGGESTION_TYPE,
              title: flag.title,
              rationale: (flag.rationaleBullets ?? []).join("\n"),
              confidence: flag.confidence,
              payload: toInputJsonValue({
                code: flag.code,
                rationaleBullets: flag.rationaleBullets ?? [],
              }),
              status: AISuggestionStatus.PROPOSED,
            })),
          });
        }

        await tx.aIRun.update({
          where: { id: aiRun.id },
          data: {
            status: AIRunStatus.SUCCEEDED,
            finishedAt: new Date(),
            outputRaw: toInputJsonValue(parsed),
          },
        });
      });

      await safeLogAudit({
        projectId,
        actorType: AuditActorType.AI,
        actorId: aiRun.id,
        action: "AI_RUN_SUCCEEDED",
        entityType: AuditEntityType.AI_RUN,
        entityId: aiRun.id,
        summary: "AI grooming scan completed successfully",
      }).catch((error) => logError("Failed to audit AI scan success", error));

      return NextResponse.json({
        runId: aiRun.id,
        flaggedCount: newSuggestions.length,
      });
    } catch (error) {
      logError("Backlog grooming scan failed", error);

      await prisma.aIRun.update({
        where: { id: aiRun.id },
        data: {
          status: AIRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        },
      });

      await safeLogAudit({
        projectId,
        actorType: AuditActorType.AI,
        actorId: aiRun.id,
        action: "AI_RUN_FAILED",
        entityType: AuditEntityType.AI_RUN,
        entityId: aiRun.id,
        summary: "AI grooming scan failed",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }).catch((auditError) => logError("Failed to audit AI scan failure", auditError));

      return jsonError("Failed to scan backlog", 500);
    }
  });
}
