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
  generateOpenQuestions,
  type StandupSummaryRendered,
  type StandupSummaryV1,
} from "@/lib/standupSummary";
import { calculateStandupQuality } from "@/lib/standupQuality";
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
        actions_required: (summaryJson.actions_required ?? []).map((item) => item.title),
        achievements: summaryJson.achievements.map((item) => item.text),
        blockers: summaryJson.blockers.map((item) => item.text),
        dependencies: summaryJson.dependencies.map((item) => item.text),
        assignment_gaps: summaryJson.assignment_gaps.map((item) => item.text),
      };
    }


    if (!summaryJson) {
      summaryJson = {
        summary_id: summaryId,
        project_id: projectId,
        date: formatDateOnly(date),
        overall_progress: entries.length
          ? `Captured ${entries.length} stand-up update${entries.length === 1 ? "" : "s"} for ${formatDateOnly(date)}.`
          : `No stand-up entries were submitted for ${formatDateOnly(date)}.`,
        actions_required: [],
        open_questions: generateOpenQuestions(entries as any, summaryId),
        achievements: entries
          .filter((entry) => entry.summaryToday?.trim())
          .map((entry) => ({
            id: `achievement-${entry.id}`,
            text: `${entry.user.name || entry.user.email || entry.userId}: ${entry.summaryToday?.trim()}`,
            source_entry_ids: [entry.id],
            linked_work_ids: [
              ...entry.issues.map((link) => link.issue.id),
              ...entry.research.map((link) => link.researchItem.id),
            ],
          })),
        blockers: entries
          .filter((entry) => entry.blockers?.trim())
          .map((entry) => ({
            id: `blocker-${entry.id}`,
            text: `${entry.user.name || entry.user.email || entry.userId}: ${entry.blockers?.trim()}`,
            source_entry_ids: [entry.id],
            linked_work_ids: [
              ...entry.issues.map((link) => link.issue.id),
              ...entry.research.map((link) => link.researchItem.id),
            ],
          })),
        dependencies: entries
          .filter((entry) => entry.dependencies?.trim())
          .map((entry) => ({
            id: `dependency-${entry.id}`,
            text: `${entry.user.name || entry.user.email || entry.userId}: ${entry.dependencies?.trim()}`,
            source_entry_ids: [entry.id],
            linked_work_ids: [
              ...entry.issues.map((link) => link.issue.id),
              ...entry.research.map((link) => link.researchItem.id),
            ],
          })),
        assignment_gaps: entries
          .filter((entry) => entry.issues.length + entry.research.length === 0)
          .map((entry) => ({
            id: `gap-${entry.id}`,
            text: `${entry.user.name || entry.user.email || entry.userId} has no linked issues or research items.`,
            source_entry_ids: [entry.id],
            linked_work_ids: [],
          })),
      };

      summaryRendered = {
        overall_progress: summaryJson.overall_progress,
        actions_required: [],
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
        `**Action required today**\n${summaryRendered.actions_required.length ? summaryRendered.actions_required.map((item) => `- ${item}`).join("\n") : "- None reported"}`,
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

    const isProjectAdmin =
      user.role === "ADMIN" ||
      projectMembers.some(
        (member) => member.userId === user.id && member.role === "ADMIN"
      );

    const quality = calculateStandupQuality(
      entries.map((entry) => ({
        summaryToday: entry.summaryToday,
        progressSinceYesterday: entry.progressSinceYesterday,
        blockers: entry.blockers,
        isComplete: entry.isComplete,
        linkedWorkCount: entry.issues.length + entry.research.length,
      })),
      projectMembers.length
    );

    await prisma.standupQualityDaily.upsert({
      where: { projectId_date: { projectId, date } },
      update: {
        qualityScore: quality.qualityScore,
        metricsJson: quality.metrics,
      },
      create: {
        projectId,
        date,
        qualityScore: quality.qualityScore,
        metricsJson: quality.metrics,
      },
    });


    const clarificationModel = (prisma as any).standupEntryClarification;
    const clarifications = clarificationModel?.findMany
      ? await clarificationModel.findMany({
          where: {
            projectId,
            entryId: { in: entries.map((entry) => entry.id) },
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const mappedEntries = entries.map((entry) => ({
      ...entry,
      standup_entry_id: entry.id,
      member_id: entry.userId,
      linked_work_ids: [
        ...entry.issues.map((link) => link.issue.key || link.issue.id),
        ...entry.research.map((link) => link.researchItem.key || link.researchItem.id),
      ],
    }));

    return NextResponse.json({
      date: formatDateOnly(date),
      summary: summaryText,
      summary_id: summaryId,
      version: latestVersion?.version ?? 0,
      summary_rendered: summaryRendered,
      summary_json: summaryJson,
      data_quality: isProjectAdmin
        ? {
            quality_score: quality.qualityScore,
            metrics: quality.metrics,
          }
        : null,
      entries: mappedEntries,
      members,
      clarifications: clarifications.map((record: any) => ({
        id: record.id,
        entry_id: record.entryId,
        question_id: record.questionId,
        answer: record.answer,
        status: record.status,
        dismissed_until: record.dismissedUntil,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Failed to generate stand-up summary", error);
    return NextResponse.json(
      { message: "Unable to generate stand-up summary" },
      { status: 500 }
    );
  }
}
