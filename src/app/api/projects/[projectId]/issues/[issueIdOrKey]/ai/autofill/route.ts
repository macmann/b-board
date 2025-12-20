import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { chatJson } from "@/lib/ai/aiClient";
import { getUserFromRequest } from "@/lib/auth";
import { jsonError } from "@/lib/apiResponse";
import { safeLogAudit } from "@/lib/auditLogger";
import prisma from "@/lib/db";
import { resolveIssueId } from "@/lib/issues";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES,
} from "@/lib/permissions";
import { toInputJsonValue } from "@/lib/prisma/json";
import {
  AISuggestionStatus,
  AISuggestionTargetType,
  AuditActorType,
  AuditEntityType,
  FeatureType,
  IssueType,
} from "@/lib/prismaEnums";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";
import { logError } from "@/lib/logger";

const bodySchema = z.object({
  mode: z.enum(["ON_DEMAND", "AUTO_ON_OPEN"]).optional(),
});

const aiResponseSchema = z.object({
  draft: z.object({
    userStory: z.string(),
    description: z.string(),
    acceptanceCriteria: z.array(z.string()),
    assumptions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    outOfScope: z.array(z.string()),
  }),
});

const buildPrompt = (options: {
  projectName: string;
  projectBrief?: string | null;
  issue: { title: string; description: string | null; type: IssueType };
  similarIssues: Array<{ title: string }>;
}) => {
  const schema = `{
  "draft": {
    "userStory": "As a ... I want ... so that ...",
    "description": "markdown string",
    "acceptanceCriteria": ["Given ... When ... Then ..."],
    "assumptions": ["..."],
    "openQuestions": ["..."],
    "outOfScope": ["..."]
  }
}`;

  const instructions = [
    "Create a complete agile user story using the context provided.",
    "Keep the user story concise but actionable.",
    "Acceptance criteria must follow a Given/When/Then or similarly testable structure.",
    "Assumptions and open questions should be explicit so the team can confirm them later.",
    "Respond ONLY with JSON matching the schema.",
  ].join("\n");

  const payload = {
    project: {
      name: options.projectName,
      brief: options.projectBrief?.trim() || "No project brief provided.",
    },
    issue: {
      title: options.issue.title,
      description: options.issue.description ?? "",
      type: options.issue.type,
    },
    similarIssues: options.similarIssues,
  };

  return {
    system: "You write crisp, unambiguous user story drafts for software teams.",
    user: `${instructions}\nSchema:${schema}\nContext:${JSON.stringify(payload, null, 2)}`,
    snapshot: payload,
  };
};

async function fetchSimilarIssues(projectId: string, issueId: string, type: IssueType) {
  const similar = await prisma.issue.findMany({
    where: { projectId, id: { not: issueId }, type },
    select: { title: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });

  return similar.map((item) => ({ title: item.title }));
}

type AutoFillParams = ProjectParams & { issueIdOrKey?: string };

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<AutoFillParams> }
) {
  return withRequestContext(request, async () => {
    const params = await ctx.params;
    const projectId = await resolveProjectId(params);

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const issueIdOrKey = (params as { issueIdOrKey?: string }).issueIdOrKey;
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

    const issueId = await resolveIssueId(projectId, issueIdOrKey ?? null);

    if (!issueId) {
      return jsonError("Issue not found", 404);
    }

    const [project, settings, issue] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.projectAISettings.findUnique({ where: { projectId } }),
      prisma.issue.findUnique({ where: { id: issueId } }),
    ]);

    if (!project || !issue) {
      return jsonError("Issue not found", 404);
    }

    if (!settings?.backlogGroomingEnabled) {
      return jsonError("Backlog grooming AI is not enabled for this project", 409);
    }

    const body = await request.json().catch(() => ({}));
    const parsedBody = bodySchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonError("Invalid request body", 400);
    }

    const mode = parsedBody.data.mode ?? "ON_DEMAND";

    const similarIssues = await fetchSimilarIssues(projectId, issueId, issue.type);

    const { system, user: userPrompt, snapshot } = buildPrompt({
      projectName: project.name,
      projectBrief: settings.projectBrief,
      issue: { title: issue.title, description: issue.description, type: issue.type },
      similarIssues,
    });

    let draftResult: z.infer<typeof aiResponseSchema>["draft"];

    try {
      const aiResponse = await chatJson({
        model: settings.model ?? undefined,
        temperature: settings.temperature ?? undefined,
        system,
        user: userPrompt,
      });

      draftResult = aiResponseSchema.parse(aiResponse).draft;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI error";
      logError("AI autofill generation failed", error);
      return jsonError(message, 502);
    }

    const suggestion = await prisma.aISuggestion.create({
      data: {
        projectId,
        featureType: FeatureType.BACKLOG_GROOMING,
        targetType: AISuggestionTargetType.ISSUE,
        targetId: issueId,
        suggestionType: "AUTOFILL_USER_STORY",
        title: `User story draft for ${issue.title}`,
        rationale: `Generated in ${mode} mode`,
        confidence: 0.9,
        payload: toInputJsonValue(draftResult),
        status: AISuggestionStatus.PROPOSED,
      },
    });

    await safeLogAudit({
      projectId,
      actorType: AuditActorType.USER,
      actorId: user.id,
      action: "AI_AUTOFILL_USER_STORY",
      entityType: AuditEntityType.AI_SUGGESTION,
      entityId: suggestion.id,
      summary: `AI autofill draft generated for ${issue.title}`,
      before: { snapshot },
      after: suggestion,
      metadata: { mode },
    }).catch((error) => logError("Failed to record AI autofill audit log", error));

    return NextResponse.json(suggestion, { status: 201 });
  });
}
