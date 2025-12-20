import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";

const parseDate = (value: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const searchParams = request.nextUrl.searchParams;
  const date = parseDate(searchParams.get("date"));
  const startDate = parseDate(searchParams.get("startDate"));
  const endDate = parseDate(searchParams.get("endDate"));
  const userId = searchParams.get("userId");

  const dateFilter = date
    ? { date }
    : startDate || endDate
      ? {
          date: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {};

  const entries = await prisma.dailyStandupEntry.findMany({
    where: {
      projectId,
      ...(userId ? { userId } : {}),
      ...dateFilter,
    },
    include: {
      user: true,
      issues: { include: { issue: true } },
      research: { include: { researchItem: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(entries);
}
