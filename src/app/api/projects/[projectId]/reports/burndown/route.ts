import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import type { ProjectParams } from "@/lib/params";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";
import { Role } from "@/lib/prismaEnums";
import { fetchBurndownPoints } from "@/lib/reports/data";
import { parseReportFilters, type ReportFilters } from "@/lib/reports/dto";

const formatDate = (value: Date) => value.toISOString().slice(0, 10);

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const parsed = await parseReportFilters(request, params);

  if ("error" in parsed) {
    return parsed.error;
  }

  const { filters } = parsed;
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: filters.projectId },
  });

  if (!project) {
    return NextResponse.json({ ok: false, message: "Project not found" }, { status: 404 });
  }

  try {
    await requireProjectRole(user.id, filters.projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: error.status }
      );
    }

    logError("Failed to authorize burndown report", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }

  let resolvedFilters: ReportFilters = filters;

  if (filters.sprintId && filters.sprintId !== "all") {
    const sprint = await prisma.sprint.findFirst({
      where: { id: filters.sprintId, projectId: filters.projectId },
      select: { startDate: true, endDate: true },
    });

    if (!sprint) {
      return NextResponse.json({ ok: false, message: "Sprint not found" }, { status: 404 });
    }

    const from = sprint.startDate ? formatDate(sprint.startDate) : filters.from;
    const to = sprint.endDate ? formatDate(sprint.endDate) : filters.to;

    if (new Date(to).getTime() < new Date(from).getTime()) {
      return NextResponse.json({ ok: false, message: "Invalid sprint date range" }, { status: 400 });
    }

    resolvedFilters = { ...filters, from, to };
  }

  try {
    const data = await fetchBurndownPoints(resolvedFilters);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    logError("Failed to load burndown report", error);
    return NextResponse.json(
      { ok: false, message: "Failed to load burndown report" },
      { status: 500 }
    );
  }
}
