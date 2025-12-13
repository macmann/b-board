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

    const projectMembers = await prisma.projectMember.findMany({
      where: { projectId },
      include: { user: true },
    });

    const existingSummary =
      typeof prisma.standupSummary?.findUnique === "function"
        ? await prisma.standupSummary.findUnique({
            where: { projectId_date: { projectId, date } },
          })
        : null;

    let summaryText = existingSummary?.summary ?? "";

    if ((!summaryText || forceRefresh) && typeof saveProjectStandupSummary === "function") {
      try {
        summaryText = (
          await saveProjectStandupSummary(projectId, date, entries)
        )?.summary;
      } catch (err) {
        summaryText = existingSummary?.summary ?? "";
      }
    }

    const members = projectMembers.map((member) => {
      const entry = entries.find((item) => item.userId === member.userId);
      return {
        userId: member.userId,
        name: member.user?.name ?? "Unknown User",
        status: entry ? "submitted" : "missing",
        isComplete: entry?.isComplete ?? false,
        issues: entry?.issues.map((link) => link.issue) ?? [],
        research: entry?.research.map((link) => link.researchItem) ?? [],
      };
    });

    return NextResponse.json({
      date: formatDateOnly(date),
      summary: summaryText,
      members,
    });
  } catch (error) {
    console.error("Failed to generate stand-up summary", error);
    return NextResponse.json(
      { message: "Unable to generate stand-up summary" },
      { status: 500 }
    );
  }
}
