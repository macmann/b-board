import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { ensureProjectRole, ForbiddenError, PROJECT_VIEWER_ROLES } from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { logProjectEvent } from "@/lib/standupInsights";

const feedbackSchema = z.object({
  summaryVersionId: z.string().min(1),
  sectionType: z.string().min(1),
  bulletId: z.string().min(1).optional(),
  feedbackType: z.enum(["USEFUL", "INCORRECT", "NEEDS_IMPROVEMENT"]),
  comment: z.string().trim().max(1000).nullable().optional(),
});


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

  const feedback = await prisma.aIFeedback.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ feedback });
}

export async function POST(
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

  const parsed = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid payload", errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const summaryVersion = await prisma.aISummaryVersion.findUnique({
    where: { id: parsed.data.summaryVersionId },
    select: { id: true, projectId: true },
  });

  if (!summaryVersion || summaryVersion.projectId !== projectId) {
    return NextResponse.json({ message: "Summary version not found" }, { status: 404 });
  }

  const normalizedBulletId = parsed.data.bulletId ?? "";

  const feedback = await prisma.aIFeedback.upsert({
    where: {
      summaryVersionId_userId_sectionType_bulletId: {
        summaryVersionId: parsed.data.summaryVersionId,
        userId: user.id,
        sectionType: parsed.data.sectionType,
        bulletId: normalizedBulletId,
      },
    },
    update: {
      feedbackType: parsed.data.feedbackType,
      comment: parsed.data.comment,
      updatedAt: new Date(),
    },
    create: {
      summaryVersionId: parsed.data.summaryVersionId,
      sectionType: parsed.data.sectionType,
      bulletId: normalizedBulletId,
      feedbackType: parsed.data.feedbackType,
      comment: parsed.data.comment,
      userId: user.id,
      projectId,
    },
  });

  await logProjectEvent("FeedbackSubmitted", {
    projectId,
    userId: user.id,
    metadataJson: {
      summaryVersionId: parsed.data.summaryVersionId,
      sectionType: parsed.data.sectionType,
      bulletId: parsed.data.bulletId,
      feedbackType: parsed.data.feedbackType,
    },
  });

  return NextResponse.json({ feedback });
}
