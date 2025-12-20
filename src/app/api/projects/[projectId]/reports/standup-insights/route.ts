import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import type { ProjectParams } from "@/lib/params";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";
import { Role } from "@/lib/prismaEnums";
import { fetchStandupInsights } from "@/lib/reports/data";
import { parseReportFilters } from "@/lib/reports/dto";

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

    logError("Failed to authorize standup insights report", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }

  try {
    const data = await fetchStandupInsights(filters);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    logError("Failed to load standup insights report", error);
    return NextResponse.json(
      { ok: false, message: "Failed to load standup insights report" },
      { status: 500 }
    );
  }
}
