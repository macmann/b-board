import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import { withRequestContext, setRequestContextUser } from "@/lib/requestContext";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
} from "@/lib/permissions";
import { chatJson } from "@/lib/ai/aiClient";
import {
  AuditActorType,
  AuditEntityType,
  AIRunStatus,
  FeatureType,
  IssuePriority,
  IssueStatus,
  AISuggestionStatus,
  AISuggestionTargetType,
} from "@/lib/prismaEnums";
import { safeLogAudit } from "@/lib/auditLogger";
import { logError } from "@/lib/logger";
import { toInputJsonValue } from "@/lib/prisma/json";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;
const COMMENT_PREVIEW_LENGTH = 500;

const priorityRank: Record<IssuePriority, number> = {
  [IssuePriority.CRITICAL]: 4,
  [IssuePriority.HIGH]: 3,
  [IssuePriority.MEDIUM]: 2,
  [IssuePriority.LOW]: 1,
};

const aiResponseSchema = z.object({
  issues: z.array(
    z.object({
      issueId: z.string(),
      suggestions: z.array(
        z.object({
          suggestionType: z.enum(["QUALITY_FLAG", "IMPROVE_TEXT", "SIZE_RISK"]),
          title: z.string(),
          rationaleBullets: z.array(z.string()).optional().default([]),
          confidence: z.number(),
          payload: z.object({
            recommendedTitle: z.string().optional(),
            recommendedDescription: z.string().optional(),
            recommendedAcceptanceCriteria: z.array(z.string()).optional(),
            notes: z.array(z.string()).optional(),
          }),
        })
      ),
    })
  ),
});

type IssueWithComments = Awaited<
  ReturnType<typeof fetchIssuesForAnalysis>
>[number];

function truncate(text: string | null | undefined, maxLength: number) {
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

async function fetchIssuesForAnalysis(options: {
  projectId: string;
  issueIds?: string[];
  limit: number;
}) {
  const include = {
    comments: {
      orderBy: { createdAt: "desc" as const },
      take: 5,
      include: {
        author: { select: { name: true, email: true } },
      },
    },
  };

  if (options.issueIds && options.issueIds.length > 0) {
    return prisma.issue.findMany({
      where: {
        projectId: options.projectId,
        id: { in: options.issueIds },
      },
      include,
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  const issues = await prisma.issue.findMany({
    where: {
      projectId: options.projectId,
      sprintId: null,
      status: { not: IssueStatus.DONE },
    },
    include,
    orderBy: [
      { priority: "desc" },
      { updatedAt: "desc" },
    ],
    take: options.limit,
  });

  return issues.sort((a, b) => {
    const priorityDiff = (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
    if (priorityDiff !== 0) return priorityDiff;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

function buildAiPrompt(issues: IssueWithComments[]) {
  const issueSummaries = issues.map((issue) => ({
    issueId: issue.id,
    key: issue.key,
    title: issue.title,
    description: issue.description ?? "",
    labels: [],
    priority: issue.priority,
    type: issue.type,
    status: issue.status,
    updatedAt: issue.updatedAt,
    lastComments: issue.comments.map((comment) => ({
      commentId: comment.id,
      author: comment.author?.name ?? comment.author?.email ?? "Unknown",
      createdAt: comment.createdAt,
      body: truncate(comment.body, COMMENT_PREVIEW_LENGTH),
    })),
  }));

  const schema = `{
  "issues": [
    {
      "issueId": "string",
      "suggestions": [
        {
          "suggestionType": "QUALITY_FLAG" | "IMPROVE_TEXT" | "SIZE_RISK",
          "title": "string",
          "rationaleBullets": ["string"],
          "confidence": 0.0,
          "payload": {
            "recommendedTitle": "string",
            "recommendedDescription": "string",
            "recommendedAcceptanceCriteria": ["string"],
            "notes": ["string"]
          }
        }
      ]
    }
  ]
}`;

  return {
    user: `You are an expert agile coach. Analyze the backlog issues and propose suggestions. Only respond with JSON that strictly matches this schema:\n${schema}\nDo not include any markdown or commentary. Issues to analyze:\n${JSON.stringify(issueSummaries, null, 2)}`,
    snapshot: issueSummaries,
  };
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
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

    const settings = await prisma.projectAISettings.findUnique({
      where: { projectId },
    });

    if (!settings?.backlogGroomingEnabled) {
      return jsonError("Backlog grooming AI is not enabled for this project", 409);
    }

    const body = await request.json().catch(() => ({}));
    const issueIds = Array.isArray(body.issueIds)
      ? body.issueIds.filter((id: unknown): id is string => typeof id === "string")
      : undefined;

    const limitInput = Number(body.limit ?? DEFAULT_LIMIT);
    const limit = Number.isFinite(limitInput)
      ? Math.min(Math.max(1, Math.floor(limitInput)), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const issues = await fetchIssuesForAnalysis({
      projectId,
      issueIds,
      limit,
    });

    if (issues.length === 0) {
      return jsonError("No issues found to analyze", 404);
    }

    const { user: userPrompt, snapshot } = buildAiPrompt(issues);

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
      action: "AI_GROOMING_TRIGGERED",
      entityType: AuditEntityType.AI_RUN,
      entityId: aiRun.id,
      summary: "Backlog grooming analysis requested",
    }).catch((error) => logError("Failed to write grooming audit log", error));

    try {
      const systemPrompt =
        "You are a precise JSON generator. Provide thoughtful backlog grooming insights and respond only with valid JSON.";

      const aiResultUnknown = await chatJson({
        model: settings.model ?? undefined,
        temperature: settings.temperature ?? undefined,
        user: userPrompt,
        system: systemPrompt,
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
          summary: "AI grooming run failed validation",
          metadata: error instanceof z.ZodError ? { zodErrors: error.flatten() } : undefined,
        }).catch((auditError) => logError("Failed to audit AI run failure", auditError));

        return jsonError("AI response validation failed", 500);
      }

      const issueIdLookup = issues.reduce((lookup, issue) => {
        lookup.set(issue.id, issue.id);
        if (issue.key) {
          lookup.set(issue.key, issue.id);
        }
        return lookup;
      }, new Map<string, string>());

      const suggestions = parsed.issues.flatMap((issue) => {
        const targetId = issueIdLookup.get(issue.issueId);

        if (!targetId) {
          if (process.env.NODE_ENV !== "production") {
            console.debug(
              `[ai/backlog-grooming] Skipping suggestion for unknown issue identifier: ${issue.issueId}`
            );
          }
          return [] as Array<{ issueId: string; suggestion: (typeof issue.suggestions)[number] }>;
        }

        if (process.env.NODE_ENV !== "production" && targetId !== issue.issueId) {
          console.debug(
            `[ai/backlog-grooming] Normalized AI response issue identifier ${issue.issueId} to issue ID ${targetId}`
          );
        }

        return issue.suggestions.map((suggestion) => ({ issueId: targetId, suggestion }));
      });

      await prisma.$transaction(async (tx) => {
        if (suggestions.length > 0) {
          await tx.aISuggestion.createMany({
            data: suggestions.map(({ issueId, suggestion }) => ({
              projectId,
              featureType: FeatureType.BACKLOG_GROOMING,
              targetType: AISuggestionTargetType.ISSUE,
              targetId: issueId,
              suggestionType: suggestion.suggestionType,
              title: suggestion.title,
              rationale: (suggestion.rationaleBullets ?? []).join("\n"),
              confidence: suggestion.confidence,
              payload: toInputJsonValue({
                ...suggestion.payload,
                rationaleBullets: suggestion.rationaleBullets ?? [],
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
            outputRaw: toInputJsonValue(aiResultUnknown),
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
        summary: "AI grooming run completed successfully",
      }).catch((error) => logError("Failed to audit AI run success", error));

      return NextResponse.json({
        runId: aiRun.id,
        suggestionCount: suggestions.length,
      });
    } catch (error) {
      logError("Backlog grooming analysis failed", error);

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
        summary: "AI grooming run failed",
        metadata: { error: error instanceof Error ? error.message : String(error) },
      }).catch((auditError) => logError("Failed to audit AI run failure", auditError));

      return jsonError("Failed to analyze backlog", 500);
    }
  });
}
