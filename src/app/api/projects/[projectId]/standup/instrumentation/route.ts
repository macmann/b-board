import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { ensureProjectRole, ForbiddenError, PROJECT_ADMIN_ROLES } from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { computeAndStoreKPIDaily } from "@/lib/standupInsights";

const toDateOnly = (date: Date) => new Date(date.toISOString().slice(0, 10));

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
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    throw error;
  }

  const now = toDateOnly(new Date());
  const start = new Date(now);
  start.setDate(start.getDate() - 13);

  const days: Date[] = [];
  for (let i = 0; i < 14; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    days.push(toDateOnly(date));
  }

  await Promise.all(days.map((date) => computeAndStoreKPIDaily(projectId, date)));

  const [kpiRows, feedbackRows, validationRows] = await Promise.all([
    prisma.kPIDaily.findMany({
      where: { projectId, date: { gte: start, lte: now } },
      orderBy: { date: "asc" },
    }),
    prisma.aIFeedback.findMany({
      where: { projectId, createdAt: { gte: start } },
      select: { createdAt: true, feedbackType: true },
    }),
    prisma.aIValidationFlag.findMany({
      where: {
        summaryVersion: {
          projectId,
          date: { gte: start, lte: now },
        },
      },
      include: {
        summaryVersion: {
          select: { date: true },
        },
      },
    }),
  ]);

  const feedbackByDay: Record<string, Record<string, number>> = {};
  for (const row of feedbackRows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    feedbackByDay[key] ??= { USEFUL: 0, INCORRECT: 0, NEEDS_IMPROVEMENT: 0 };
    feedbackByDay[key][row.feedbackType] = (feedbackByDay[key][row.feedbackType] ?? 0) + 1;
  }

  const validationByDay: Record<string, number> = {};
  for (const row of validationRows) {
    const key = row.summaryVersion.date.toISOString().slice(0, 10);
    validationByDay[key] = (validationByDay[key] ?? 0) + 1;
  }

  return NextResponse.json({
    kpi_daily: kpiRows,
    feedback_trend: feedbackByDay,
    validation_flags_per_day: validationByDay,
  });
}
