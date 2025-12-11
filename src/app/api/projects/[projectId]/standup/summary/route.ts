import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../../lib/auth";
import prisma from "../../../../../../lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
} from "../../../../../../lib/permissions";
import { resolveProjectId, type ProjectParams } from "../../../../../../lib/params";
import { saveProjectStandupSummary } from "../../../../../../lib/standupSummary";
import { parseDateOnly } from "../../../../../../lib/standupWindow";

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
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
  const dateParam = searchParams.get("date");
  const forceRefresh = searchParams.get("forceRefresh") === "true";
  const date = parseDateOnly(dateParam);

  if (!date || !dateParam) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  try {
    const entries = await prisma.dailyStandupEntry.findMany({
      where: { projectId, date },
      include: {
        user: true,
        issues: { include: { issue: true } },
        research: { include: { researchItem: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const existingSummary = await prisma.standupSummary.findUnique({
      where: { projectId_date: { projectId, date } },
    });

    const summaryRecord =
      existingSummary && !forceRefresh
        ? existingSummary
        : await saveProjectStandupSummary(projectId, date, entries);

    return NextResponse.json({
      date: formatDateOnly(date),
      summary: summaryRecord.summary,
      entries,
    });
  } catch (error) {
    console.error("Failed to generate stand-up summary", error);
    return NextResponse.json(
      { message: "Unable to generate stand-up summary" },
      { status: 500 }
    );
  }
}
