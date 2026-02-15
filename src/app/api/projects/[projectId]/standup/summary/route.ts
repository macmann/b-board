import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  saveProjectStandupSummary,
  type StandupSummaryRendered,
  type StandupSummaryV1,
} from "@/lib/standupSummary";
import { parseDateOnly } from "@/lib/standupWindow";

const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

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

    let summaryText = "";
    let summaryJson: StandupSummaryV1 | null = null;
    let summaryRendered: StandupSummaryRendered | null = null;
    const summaryId = `${projectId}:${formatDateOnly(date)}`;

    const canReadSummaryVersions =
      typeof prisma.aISummaryVersion?.findFirst === "function";

    let latestVersion = canReadSummaryVersions
      ? await prisma.aISummaryVersion.findFirst({
          where: { summaryId },
          orderBy: { version: "desc" },
        })
      : null;

    if (forceRefresh || !latestVersion) {
      try {
        await saveProjectStandupSummary(projectId, date, entries, user.id);
        latestVersion = canReadSummaryVersions
          ? await prisma.aISummaryVersion.findFirst({
              where: { summaryId },
              orderBy: { version: "desc" },
            })
          : null;
      } catch {
        // continue with legacy summary fallback below
      }
    }

    if (latestVersion) {
      summaryJson = latestVersion.outputJson as StandupSummaryV1;
      summaryRendered = {
        overall_progress: summaryJson.overall_progress,
        achievements: summaryJson.achievements.map((item) => item.text),
        blockers: summaryJson.blockers.map((item) => item.text),
        dependencies: summaryJson.dependencies.map((item) => item.text),
        assignment_gaps: summaryJson.assignment_gaps.map((item) => item.text),
      };
    }

    const existingSummary =
      typeof prisma.standupSummary?.findUnique === "function"
        ? await prisma.standupSummary.findUnique({
            where: { projectId_date: { projectId, date } },
          })
        : null;

    summaryText = existingSummary?.summary ?? "";

    if (!summaryText && summaryRendered) {
      summaryText = [
        `**Overall progress**\n${summaryRendered.overall_progress}`,
        `**Achievements**\n${summaryRendered.achievements.length ? summaryRendered.achievements.map((item) => `- ${item}`).join("\n") : "- None reported"}`,
        `**Blockers and risks**\n${summaryRendered.blockers.length ? summaryRendered.blockers.map((item) => `- ${item}`).join("\n") : "- None reported"}`,
        `**Dependencies requiring PO involvement**\n${summaryRendered.dependencies.length ? summaryRendered.dependencies.map((item) => `- ${item}`).join("\n") : "- None reported"}`,
        `**Assignment gaps**\n${summaryRendered.assignment_gaps.length ? summaryRendered.assignment_gaps.map((item) => `- ${item}`).join("\n") : "- None reported"}`,
      ].join("\n\n");
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
      summary_id: summaryId,
      version: latestVersion?.version ?? 0,
      summary_rendered: summaryRendered,
      summary_json: summaryJson,
      entries,
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
