import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { ensureProjectRole, ForbiddenError, PROJECT_VIEWER_ROLES } from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { logProjectEvent } from "@/lib/standupInsights";

const EVENT_RATE_LIMIT_PER_MINUTE = 60;

const eventSchema = z.object({
  type: z.enum([
    "SummaryViewed",
    "CopyClicked",
    "EvidenceClicked",
    "RegenerateClicked",
    "FeedbackSubmitted",
  ]),
  clientEventId: z.string().uuid(),
  summaryVersionId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const rateCount = await prisma.event.count({
    where: {
      userId: user.id,
      projectId,
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (rateCount >= EVENT_RATE_LIMIT_PER_MINUTE) {
    return NextResponse.json({ message: "Rate limit exceeded" }, { status: 429 });
  }

  if (parsed.data.summaryVersionId) {
    const summaryVersion = await prisma.aISummaryVersion.findUnique({
      where: { id: parsed.data.summaryVersionId },
      select: { projectId: true },
    });

    if (!summaryVersion || summaryVersion.projectId !== projectId) {
      return NextResponse.json(
        { message: "summaryVersionId does not belong to this project" },
        { status: 400 }
      );
    }
  }

  const created = await logProjectEvent(parsed.data.type, {
    projectId,
    userId: user.id,
    clientEventId: parsed.data.clientEventId,
    summaryVersionId: parsed.data.summaryVersionId,
    metadataJson: parsed.data.metadata as any,
  });

  return NextResponse.json({ ok: true, deduped: created === null });
}
