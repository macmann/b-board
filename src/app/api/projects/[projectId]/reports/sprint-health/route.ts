import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import type { ProjectParams } from "@/lib/params";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";
import { Role } from "@/lib/prismaEnums";
import { fetchSprintHealthReport } from "@/lib/reports/data";
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

  const [project, membership, userRole] = await Promise.all([
    prisma.project.findUnique({ where: { id: filters.projectId } }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: filters.projectId, userId: user.id } },
      select: { role: true },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { role: true } }),
  ]);

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

    logError("Failed to authorize sprint health report", error);
    return NextResponse.json(
      { ok: false, message: "Internal server error" },
      { status: 500 }
    );
  }

  try {
    const projectRole = userRole?.role === Role.ADMIN ? "ADMIN" : (membership?.role ?? null);
    const data = await fetchSprintHealthReport(filters, { userId: user.id, projectRole });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    logError("Failed to load sprint health report", error);
    return NextResponse.json(
      { ok: false, message: "Failed to load sprint health report" },
      { status: 500 }
    );
  }
}
