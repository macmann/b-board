import { Prisma, type DailyStandupEntry, type Role } from "@prisma/client";

import prisma from "@/lib/db";

import type { StandupSummaryV1 } from "./standupSummary";

type ValidationFlag = {
  flagType: string;
  detailsJson: Prisma.InputJsonValue;
};

const hasText = (value?: string | null) => Boolean(value?.trim());

export const buildValidationFlags = (
  summary: StandupSummaryV1,
  entries: Pick<DailyStandupEntry, "id" | "blockers" | "progressSinceYesterday" | "summaryToday">[]
): ValidationFlag[] => {
  const hasEntryBlockers = entries.some((entry) => hasText(entry.blockers));
  const summarySaysNoBlockers = summary.blockers.length === 0;
  const hasSummaryBlockers = summary.blockers.length > 0;
  const allEntryBlockersEmpty = entries.every((entry) => !hasText(entry.blockers));
  const hasSummaryAchievements = summary.achievements.length > 0;
  const allProgressFieldsEmpty = entries.every(
    (entry) => !hasText(entry.progressSinceYesterday) && !hasText(entry.summaryToday)
  );

  const flags: ValidationFlag[] = [];

  if (summarySaysNoBlockers && hasEntryBlockers) {
    flags.push({
      flagType: "NO_BLOCKERS_CONTRADICTION",
      detailsJson: {
        reason: "Summary claims no blockers but source entries include blocker text.",
      },
    });
  }

  if (hasSummaryBlockers && allEntryBlockersEmpty) {
    flags.push({
      flagType: "BLOCKERS_WITHOUT_SOURCE",
      detailsJson: {
        reason: "Summary lists blockers while all standup blocker fields are empty.",
      },
    });
  }

  if (hasSummaryAchievements && allProgressFieldsEmpty) {
    flags.push({
      flagType: "ACHIEVEMENTS_WITHOUT_PROGRESS",
      detailsJson: {
        reason:
          "Summary lists achievements while all progress and today fields are empty in source entries.",
      },
    });
  }

  return flags;
};

export const upsertValidationFlagsForSummary = async (
  summaryVersionId: string,
  summary: StandupSummaryV1,
  entries: Pick<DailyStandupEntry, "id" | "blockers" | "progressSinceYesterday" | "summaryToday">[]
) => {
  const flags = buildValidationFlags(summary, entries);

  await prisma.$transaction(async (tx) => {
    await tx.aIValidationFlag.deleteMany({ where: { summaryVersionId } });

    if (flags.length > 0) {
      await tx.aIValidationFlag.createMany({
        data: flags.map((flag) => ({
          summaryVersionId,
          flagType: flag.flagType,
          detailsJson: flag.detailsJson,
        })),
      });
    }
  });

  return flags;
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const logProjectEvent = async (
  type: string,
  payload: {
    projectId: string;
    userId: string;
    summaryVersionId?: string;
    clientEventId?: string;
    metadataJson?: Prisma.InputJsonValue;
  }
) => {
  try {
    return await prisma.event.create({
      data: {
        type,
        projectId: payload.projectId,
        userId: payload.userId,
        summaryVersionId: payload.summaryVersionId,
        clientEventId: payload.clientEventId,
        metadataJson: payload.metadataJson,
      },
    });
  } catch (error) {
    if (payload.clientEventId && isUniqueViolation(error)) {
      return null;
    }
    throw error;
  }
};

const dateOnlyUtc = (value: Date) => new Date(value.toISOString().slice(0, 10));

const percentileMedian = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const PO_VIEWER_ROLES: Role[] = ["PO", "ADMIN"];

export const computeAndStoreKPIDaily = async (projectId: string, date: Date) => {
  const dayStart = dateOnlyUtc(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [members, entries, facilitatorNotes, views] = await Promise.all([
    prisma.projectMember.count({ where: { projectId } }),
    prisma.dailyStandupEntry.findMany({ where: { projectId, date: dayStart } }),
    prisma.facilitatorNote.findMany({
      where: { projectId, createdAt: { lt: dayEnd } },
      select: { createdAt: true, resolvedAt: true, resolved: true },
    }),
    prisma.event.findMany({
      where: {
        projectId,
        type: "SummaryViewed",
        createdAt: { gte: dayStart, lt: dayEnd },
      },
      select: {
        userId: true,
        user: { select: { role: true } },
      },
    }),
  ]);

  const compliancePercent = members > 0 ? (entries.length / members) * 100 : 0;
  const blockersOpenedToday = entries.filter((entry) => hasText(entry.blockers)).length;

  const persistingBlockers = entries.filter((entry) => {
    if (!hasText(entry.blockers)) return false;
    const ageMs = dayStart.getTime() - new Date(entry.createdAt).getTime();
    return ageMs >= 2 * 24 * 60 * 60 * 1000;
  }).length;

  const blockerResolutionDays = facilitatorNotes
    .filter((note) => note.resolved && note.resolvedAt)
    .map(
      (note) =>
        (new Date(note.resolvedAt as Date).getTime() - new Date(note.createdAt).getTime()) /
        (24 * 60 * 60 * 1000)
    )
    .filter((value) => value >= 0);

  const poViews = views.filter((row) => PO_VIEWER_ROLES.includes(row.user.role)).length;

  const metricsJson = {
    day_boundary_timezone: "UTC",
    standup_compliance_percent: Number(compliancePercent.toFixed(2)),
    median_blocker_resolution_days: Number(percentileMedian(blockerResolutionDays).toFixed(2)),
    blockers_opened_today: blockersOpenedToday,
    blockers_persisting_2_plus_days: persistingBlockers,
    po_engagement_views_per_day: poViews,
  };

  await prisma.kPIDaily.upsert({
    where: { projectId_date: { projectId, date: dayStart } },
    update: { metricsJson },
    create: { projectId, date: dayStart, metricsJson },
  });

  return metricsJson;
};

export const computeSummaryConfidence = (
  summary: StandupSummaryV1,
  flagCount: number
) => {
  const bullets = [
    ...summary.achievements,
    ...summary.blockers,
    ...summary.dependencies,
    ...summary.assignment_gaps,
  ];

  const evidenceCovered = bullets.filter((bullet) => bullet.source_entry_ids.length > 0).length;
  const evidenceCoverage = bullets.length > 0 ? evidenceCovered / bullets.length : 1;
  const validationPenalty = Math.min(0.6, flagCount * 0.2);
  const confidenceScore = Math.max(0.2, evidenceCoverage - validationPenalty);

  return {
    confidenceScore: Number(confidenceScore.toFixed(2)),
    evidenceCoverage: Number(evidenceCoverage.toFixed(2)),
    validationPenalty: Number(validationPenalty.toFixed(2)),
  };
};
