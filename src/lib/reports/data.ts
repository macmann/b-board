import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import {
  IssueHistoryField,
  IssueStatus,
  ResearchStatus,
} from "@/lib/prismaEnums";

import {
  BlockerTheme,
  BurndownPoint,
  CycleTimePoint,
  CycleTimeReport,
  ReportFilters,
  StandupInsight,
  StandupInsightsReport,
  StandupSignal,
  VelocityPoint,
  SprintHealthReport,
} from "./dto";
import { computeSprintHealthScore } from "./sprintHealth";
import { buildProactiveSprintGuidance } from "./proactiveGuidance";

const toDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

const buildDateRange = (from: string, to: string) => {
  const dates: string[] = [];
  const current = toDateOnly(from);
  const end = toDateOnly(to);

  while (current.getTime() <= end.getTime()) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

const startOfDay = (date: string) => new Date(`${date}T00:00:00.000Z`);
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999Z`);

const getDoneAtMap = async (issueIds: string[]) => {
  if (!issueIds.length) return new Map<string, Date>();

  const histories = await prisma.issueHistory.findMany({
    where: {
      issueId: { in: issueIds },
      field: IssueHistoryField.STATUS,
      newValue: IssueStatus.DONE,
    },
    orderBy: { createdAt: "asc" },
  });

  return histories.reduce((map, entry) => {
    if (!map.has(entry.issueId)) {
      map.set(entry.issueId, entry.createdAt);
    }
    return map;
  }, new Map<string, Date>());
};

export const fetchBurndownPoints = async (
  filters: ReportFilters
): Promise<BurndownPoint[]> => {
  const toDate = endOfDay(filters.to);
  const issues = await prisma.issue.findMany({
    where: {
      projectId: filters.projectId,
      createdAt: { lte: toDate },
      ...(filters.sprintId && filters.sprintId !== "all"
        ? { sprintId: filters.sprintId }
        : {}),
    },
    select: {
      id: true,
      storyPoints: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const dates = buildDateRange(filters.from, filters.to);

  if (!issues.length) {
    return dates.map((date) => ({
      date,
      remainingIssues: 0,
      remainingPoints: 0,
    }));
  }

  const doneAtMap = await getDoneAtMap(issues.map((issue) => issue.id));

  return dates.map((date) => {
    const cutoff = endOfDay(date);
    let remainingIssues = 0;
    let remainingPoints = 0;

    for (const issue of issues) {
      if (issue.createdAt.getTime() > cutoff.getTime()) continue;
      const doneAt = doneAtMap.get(issue.id) ??
        (issue.status === IssueStatus.DONE ? issue.updatedAt : undefined);

      if (!doneAt || doneAt.getTime() > cutoff.getTime()) {
        remainingIssues += 1;
        if (issue.storyPoints) {
          remainingPoints += issue.storyPoints;
        }
      }
    }

    return { date, remainingIssues, remainingPoints };
  });
};

export const fetchVelocityPoints = async (
  filters: ReportFilters
): Promise<VelocityPoint[]> => {
  const sprints = await prisma.sprint.findMany({
    where: {
      projectId: filters.projectId,
      ...(filters.sprintId && filters.sprintId !== "all"
        ? { id: filters.sprintId }
        : {}),
    },
    orderBy: { startDate: "asc" },
  });

  if (!sprints.length) return [];

  const fromDate = new Date(`${filters.from}T00:00:00.000Z`);
  const toDate = endOfDay(filters.to);

  const overlappingSprints = sprints.filter((sprint) => {
    const start = sprint.startDate ?? fromDate;
    const end = sprint.endDate ?? toDate;
    return start.getTime() <= toDate.getTime() && end.getTime() >= fromDate.getTime();
  });

  const targetSprints =
    overlappingSprints.length > 0
      ? overlappingSprints
      : sprints.slice(Math.max(0, sprints.length - 6));

  const issues = await prisma.issue.findMany({
    where: {
      projectId: filters.projectId,
      sprintId: { in: targetSprints.map((sprint) => sprint.id) },
    },
    select: {
      id: true,
      sprintId: true,
      storyPoints: true,
      status: true,
      updatedAt: true,
    },
  });

  const doneAtMap = await getDoneAtMap(issues.map((issue) => issue.id));

  return targetSprints.map((sprint) => {
    const sprintIssues = issues.filter((issue) => issue.sprintId === sprint.id);
    const sprintStart = sprint.startDate ?? fromDate;
    const sprintEnd = sprint.endDate ?? toDate;

    let completedIssues = 0;
    let completedPoints = 0;

    for (const issue of sprintIssues) {
      const doneAt = doneAtMap.get(issue.id) ??
        (issue.status === IssueStatus.DONE ? issue.updatedAt : undefined);

      const completedInWindow = doneAt
        ? doneAt.getTime() >= sprintStart.getTime() && doneAt.getTime() <= sprintEnd.getTime()
        : false;

      if (completedInWindow || (!doneAt && issue.status === IssueStatus.DONE)) {
        completedIssues += 1;

        if (issue.storyPoints) {
          completedPoints += issue.storyPoints;
        }
      }
    }

    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      completedIssues,
      completedPoints,
      startDate: sprint.startDate ? sprint.startDate.toISOString().slice(0, 10) : undefined,
      endDate: sprint.endDate ? sprint.endDate.toISOString().slice(0, 10) : undefined,
    };
  });
};

export const fetchCycleTimeReport = async (
  filters: ReportFilters
): Promise<CycleTimeReport> => {
  const rangeStart = startOfDay(filters.from);
  const rangeEnd = endOfDay(filters.to);

  const issues = await prisma.issue.findMany({
    where: {
      projectId: filters.projectId,
      createdAt: { lte: rangeEnd },
      ...(filters.sprintId && filters.sprintId !== "all"
        ? { sprintId: filters.sprintId }
        : {}),
    },
    select: {
      id: true,
      key: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!issues.length) {
    return { points: [], summary: { median: null, p75: null, p90: null } };
  }

  const histories = await prisma.issueHistory.findMany({
    where: {
      issueId: { in: issues.map((issue) => issue.id) },
      field: IssueHistoryField.STATUS,
    },
    orderBy: { createdAt: "asc" },
  });

  const points: CycleTimePoint[] = [];

  for (const issue of issues) {
    const issueHistories = histories.filter(
      (history) => history.issueId === issue.id
    );

    const startedHistory = issueHistories.find(
      (history) =>
        history.newValue === IssueStatus.IN_PROGRESS ||
        history.newValue === IssueStatus.IN_REVIEW ||
        history.newValue === IssueStatus.DONE
    );

    const doneHistory = issueHistories.find(
      (history) => history.newValue === IssueStatus.DONE
    );

    const startedAt = startedHistory?.createdAt ?? issue.createdAt;
    const doneAt =
      doneHistory?.createdAt ??
      (issue.status === IssueStatus.DONE ? issue.updatedAt : undefined);

    if (!doneAt) continue;
    if (doneAt.getTime() < rangeStart.getTime()) continue;
    if (doneAt.getTime() > rangeEnd.getTime()) continue;

    const cycleTimeDays = Math.max(
      0,
      Math.round(
        (doneAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

    points.push({
      issueId: issue.id,
      key: issue.key ?? issue.id,
      title: issue.title,
      startedAt: startedAt.toISOString(),
      doneAt: doneAt.toISOString(),
      cycleTimeDays,
    });
  }

  const durations = points
    .map((point) => point.cycleTimeDays)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);

  const percentile = (p: number): number | null => {
    if (!durations.length) return null;
    const idx = (durations.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return durations[lower];
    const weight = idx - lower;
    return durations[lower] * (1 - weight) + durations[upper] * weight;
  };

  return {
    points,
    summary: {
      median: percentile(0.5),
      p75: percentile(0.75),
      p90: percentile(0.9),
    },
  };
};

export const fetchStandupInsights = async (
  filters: ReportFilters
): Promise<StandupInsightsReport> => {
  // Deterministic signal definitions for Phase 1.3 pre-nudging.
  const SIGNAL_DEFINITIONS: StandupInsightsReport["signalDefinitions"] = {
    MISSING_STANDUP: {
      timezone: "UTC",
      cutoff_hour_utc: 17,
      grace_minutes: 60,
      threshold: "2 missed standup days",
      description:
        "Missing standup is triggered after two missed days. 'since' is the first missed day after the user's latest submission in the selected range.",
    },
    PERSISTENT_BLOCKER: {
      timezone: "UTC",
      cutoff_hour_utc: 17,
      grace_minutes: 60,
      threshold: "same blocker key appears on 2+ days",
      description:
        "Persistent blocker is matched by normalized blocker text plus linked work ids. Evidence includes the full chain of matching entries.",
    },
    STALE_WORK: {
      timezone: "UTC",
      cutoff_hour_utc: 17,
      grace_minutes: 60,
      threshold: ">=72h inactive",
      description:
        "Stale work means linked work is not DONE and has no issue update + no standup mention for 72+ hours.",
    },
    LOW_CONFIDENCE: {
      timezone: "UTC",
      cutoff_hour_utc: 17,
      grace_minutes: 60,
      threshold: "entry confidence < 0.55 on 2+ entries",
      description:
        "Low confidence is based on entry penalties (missing blockers, missing linked work, vague update).",
    },
  };

  const standupQualityDailyModel = (prisma as any).standupQualityDaily;
  const reportStart = toDateOnly(filters.from);
  const reportEnd = toDateOnly(filters.to);

  const [entries, summaries, members, qualitySnapshots] = await Promise.all([
    prisma.dailyStandupEntry.findMany({
      where: {
        projectId: filters.projectId,
        date: {
          gte: reportStart,
          lte: reportEnd,
        },
      },
      select: {
        id: true,
        userId: true,
        date: true,
        blockers: true,
        dependencies: true,
        summaryToday: true,
        progressSinceYesterday: true,
        issues: { select: { issueId: true } },
        research: { select: { researchItemId: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.standupSummary.findMany({
      where: {
        projectId: filters.projectId,
        date: {
          gte: reportStart,
          lte: reportEnd,
        },
      },
      select: {
        date: true,
        summary: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.projectMember.findMany({
      where: { projectId: filters.projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    standupQualityDailyModel?.findMany
      ? standupQualityDailyModel.findMany({
          where: {
            projectId: filters.projectId,
            date: {
              gte: reportStart,
              lte: reportEnd,
            },
          },
          select: { date: true, qualityScore: true },
        })
      : Promise.resolve([]),
  ]);

  const dates = buildDateRange(filters.from, filters.to);
  const datesSet = new Set(dates);

  const byDate = new Map<string, typeof entries>();
  const summariesByDate = new Map<string, string>();

  for (const entry of entries) {
    const dateKey = entry.date.toISOString().slice(0, 10);
    const existing = byDate.get(dateKey) ?? [];
    existing.push(entry);
    byDate.set(dateKey, existing);
  }

  for (const summary of summaries) {
    summariesByDate.set(summary.date.toISOString().slice(0, 10), summary.summary);
  }

  const excerpt = (value: string | undefined) => {
    if (!value) return undefined;
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
  };

  const daily = dates.map((date) => {
    const dayEntries = byDate.get(date) ?? [];
    const blockers = dayEntries
      .map((entry) => entry.blockers?.trim())
      .filter((value): value is string => Boolean(value));

    const blockerPhrases = blockers.flatMap((blocker) =>
      blocker
        .split(/\n|\.|;/)
        .map((part) => part.trim())
        .filter(Boolean)
    );

    const topBlockers: string[] = Array.from(new Set(blockerPhrases)).slice(0, 3);
    const summary = summariesByDate.get(date);

    return {
      date,
      entryIds: dayEntries.map((entry) => entry.id),
      blockersCount: blockers.length,
      dependenciesCount: dayEntries.filter((entry) => entry.dependencies?.trim()).length,
      updatesCount: dayEntries.length,
      topBlockers,
      hasAiSummary: Boolean(summary),
      summary,
      summaryExcerpt: summary ? excerpt(summary) : undefined,
    };
  });

  const memberNameById = new Map<string, string>(
    members.map((member) => [member.userId, member.user.name || member.user.email || member.userId])
  );

  const entriesByUser = new Map<string, typeof entries>();
  entries.forEach((entry) => {
    const current = entriesByUser.get(entry.userId) ?? [];
    current.push(entry);
    entriesByUser.set(entry.userId, current);
  });

  const severityWeight = { low: 1, medium: 2, high: 3 } as const;
  const signals: StandupSignal[] = [];

  // MISSING_STANDUP
  const missingCutoffDays = 2;
  for (const member of members) {
    const memberEntries = entriesByUser.get(member.userId) ?? [];
    const submittedDates = new Set(memberEntries.map((entry) => entry.date.toISOString().slice(0, 10)));
    const lastEntry = memberEntries.at(-1);
    const sinceDate = lastEntry
      ? new Date(lastEntry.date.getTime() + 86_400_000)
      : reportStart;

    const missingDates = dates.filter((dateKey) => {
      const day = new Date(`${dateKey}T00:00:00.000Z`);
      return day >= sinceDate && !submittedDates.has(dateKey);
    });

    if (missingDates.length >= missingCutoffDays) {
      signals.push({
        id: `missing-${member.userId}`,
        signal_type: "MISSING_STANDUP",
        owner_user_id: member.userId,
        owner_name: memberNameById.get(member.userId) ?? member.userId,
        severity: missingDates.length >= 3 ? "high" : "medium",
        since: missingDates[0],
        evidence_entry_ids: lastEntry ? [lastEntry.id] : [],
        linked_work_ids: [],
      });
    }
  }

  // PERSISTENT_BLOCKER
  const normalizeBlocker = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const blockerChainByOwner = new Map<string, Map<string, typeof entries>>();
  entries.forEach((entry) => {
    const blockerText = entry.blockers?.trim();
    if (!blockerText) return;

    const linkedIssueIds = Array.from(new Set(entry.issues.map((link) => link.issueId))).sort();
    const linkedKey = linkedIssueIds.length > 0 ? linkedIssueIds.join(",") : "none";

    const phrases = blockerText
      .split(/[\n.;]+/)
      .map((part) => normalizeBlocker(part))
      .filter((part) => part.length >= 8);

    const ownerChains = blockerChainByOwner.get(entry.userId) ?? new Map<string, typeof entries>();
    phrases.forEach((phrase) => {
      const blockerKey = `${phrase}::${linkedKey}`;
      const chain = ownerChains.get(blockerKey) ?? [];
      chain.push(entry);
      ownerChains.set(blockerKey, chain);
    });
    blockerChainByOwner.set(entry.userId, ownerChains);
  });

  blockerChainByOwner.forEach((chains, ownerUserId) => {
    let bestKey = "";
    let bestChain: typeof entries = [];
    chains.forEach((chain, key) => {
      const distinctDays = new Set(chain.map((entry) => entry.date.toISOString().slice(0, 10))).size;
      if (distinctDays >= 2 && chain.length > bestChain.length) {
        bestKey = key;
        bestChain = chain;
      }
    });

    if (!bestKey || bestChain.length === 0) return;

    const ordered = [...bestChain].sort((a, b) => a.date.getTime() - b.date.getTime());
    signals.push({
      id: `persistent-blocker-${ownerUserId}`,
      signal_type: "PERSISTENT_BLOCKER",
      owner_user_id: ownerUserId,
      owner_name: memberNameById.get(ownerUserId) ?? ownerUserId,
      severity: ordered.length >= 3 ? "high" : "medium",
      since: ordered[0].date.toISOString().slice(0, 10),
      evidence_entry_ids: ordered.map((entry) => entry.id),
      linked_work_ids: Array.from(new Set(ordered.flatMap((entry) => entry.issues.map((issue) => issue.issueId)))),
    });
  });

  // STALE_WORK
  const staleHours = 72;
  const staleCutoffMs = reportEnd.getTime() - staleHours * 60 * 60 * 1000;
  const linkedIssueIds: string[] = Array.from(
    new Set<string>(entries.flatMap((entry) => entry.issues.map((issue) => issue.issueId)))
  );
  const linkedIssues = linkedIssueIds.length
    ? await prisma.issue.findMany({
        where: { id: { in: linkedIssueIds } },
        select: { id: true, updatedAt: true, status: true, assigneeId: true },
      })
    : [];

  linkedIssues
    .filter((issue) => issue.status !== IssueStatus.DONE)
    .forEach((issue) => {
      const relatedEntries = entries.filter((entry) =>
        entry.issues.some((issueLink) => issueLink.issueId === issue.id)
      );
      if (relatedEntries.length === 0) return;

      const lastMentionAt = relatedEntries
        .map((entry) => entry.date.getTime())
        .reduce((latest, current) => (current > latest ? current : latest), 0);

      if (issue.updatedAt.getTime() > staleCutoffMs || lastMentionAt > staleCutoffMs) {
        return;
      }

      const ownerUserId = issue.assigneeId ?? relatedEntries[0].userId;
      if (!ownerUserId) return;

      signals.push({
        id: `stale-work-${issue.id}`,
        signal_type: "STALE_WORK",
        owner_user_id: ownerUserId,
        owner_name: memberNameById.get(ownerUserId) ?? ownerUserId,
        severity: "medium",
        since: issue.updatedAt.toISOString().slice(0, 10),
        evidence_entry_ids: relatedEntries.map((entry) => entry.id),
        linked_work_ids: [issue.id],
      });
    });

  // LOW_CONFIDENCE
  const hasVagueContent = (entry: (typeof entries)[number]) => {
    const combined = [entry.progressSinceYesterday, entry.summaryToday]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      !combined ||
      combined.length < 25 ||
      /\b(same|as usual|n\/a|na|todo|tbd|working on it|stuff)\b/.test(combined)
    );
  };

  const confidenceByEntryId = new Map<string, number>();
  entries.forEach((entry) => {
    const penalties = [
      !entry.blockers?.trim() ? 1 : 0,
      entry.issues.length + entry.research.length === 0 ? 1 : 0,
      hasVagueContent(entry) ? 1 : 0,
    ].reduce((sum, value) => sum + value, 0);

    confidenceByEntryId.set(entry.id, Math.max(0, 1 - penalties / 3));
  });

  const confidenceThreshold = 0.55;
  const lowConfidenceEntries = entries.filter(
    (entry) => (confidenceByEntryId.get(entry.id) ?? 1) < confidenceThreshold
  );
  const lowConfidenceByUser = new Map<string, typeof entries>();
  lowConfidenceEntries.forEach((entry) => {
    const current = lowConfidenceByUser.get(entry.userId) ?? [];
    current.push(entry);
    lowConfidenceByUser.set(entry.userId, current);
  });

  lowConfidenceByUser.forEach((userEntries, ownerUserId) => {
    if (userEntries.length < 2) return;
    const ordered = [...userEntries].sort((a, b) => a.date.getTime() - b.date.getTime());
    signals.push({
      id: `low-confidence-${ownerUserId}`,
      signal_type: "LOW_CONFIDENCE",
      owner_user_id: ownerUserId,
      owner_name: memberNameById.get(ownerUserId) ?? ownerUserId,
      severity: userEntries.length >= 3 ? "high" : "low",
      since: ordered[0].date.toISOString().slice(0, 10),
      evidence_entry_ids: ordered.map((entry) => entry.id),
      linked_work_ids: Array.from(new Set(ordered.flatMap((entry) => entry.issues.map((issue) => issue.issueId)))),
    });
  });

  qualitySnapshots
    .filter((snapshot: { qualityScore: number }) => snapshot.qualityScore < 50)
    .forEach((snapshot: { date: Date; qualityScore: number }) => {
      const dateKey = snapshot.date.toISOString().slice(0, 10);
      if (!datesSet.has(dateKey)) return;
      const dayEntries = byDate.get(dateKey) ?? [];
      dayEntries.forEach((entry) => {
        signals.push({
          id: `low-confidence-quality-${entry.id}`,
          signal_type: "LOW_CONFIDENCE",
          owner_user_id: entry.userId,
          owner_name: memberNameById.get(entry.userId) ?? entry.userId,
          severity: "medium",
          since: dateKey,
          evidence_entry_ids: [entry.id],
          linked_work_ids: entry.issues.map((issue) => issue.issueId),
        });
      });
    });

  const dedupedSignals = Array.from(
    new Map(signals.map((signal) => [`${signal.signal_type}:${signal.owner_user_id}`, signal])).values()
  ).sort((a, b) => {
    const bySeverity = severityWeight[b.severity] - severityWeight[a.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.since.localeCompare(b.since);
  });

  return {
    daily,
    signals: dedupedSignals,
    signalDefinitions: SIGNAL_DEFINITIONS,
  };
};

const buildRiskConcentrationAreas = (riskDrivers: { type: string; impact: number }[]) => {
  const areas = new Set<string>();
  riskDrivers.forEach((driver) => {
    if (driver.impact >= 0) return;
    if (driver.type === "BLOCKER_CLUSTER") areas.add("Blockers");
    if (driver.type === "MISSING_STANDUP") areas.add("Standup participation");
    if (driver.type === "STALE_WORK") areas.add("Execution flow");
    if (driver.type === "LOW_QUALITY_INPUT") areas.add("Input quality");
    if (driver.type === "UNRESOLVED_ACTIONS") areas.add("Follow-through");
    if (driver.type === "END_OF_SPRINT_PRESSURE" || driver.type === "DELIVERY_RISK") areas.add("Sprint timing pressure");
  });
  return Array.from(areas);
};

const toModelStatus = (score: number): "GREEN" | "YELLOW" | "RED" => {
  if (score >= 80) return "GREEN";
  if (score >= 60) return "YELLOW";
  return "RED";
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const PROJECTION_MODEL_VERSION = "3.2.1";
const FORECAST_CONFIDENCE_WEIGHTS = {
  dataQuality: 0.4,
  velocityStability: 0.3,
  blockerVolatility: 0.15,
  linkedCoverage: 0.15,
} as const;
const FORECAST_CONFIDENCE_THRESHOLDS = {
  high: 0.75,
  medium: 0.55,
  minimumSampleDays: 5,
} as const;
const CAPACITY_THRESHOLDS = {
  openItems: 5,
  blockedItems: 2,
  idleDays: 5,
} as const;

const daysBetween = (from: Date, to: Date) =>
  Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

const computeDailySprintHealth = async (
  projectId: string,
  dateIso: string,
  options: { userId: string; projectRole: "ADMIN" | "PO" | "DEV" | "QA" | "VIEWER" | null }
) => {
  const dayStart = startOfDay(dateIso);
  const dayEnd = endOfDay(dateIso);
  const lookbackStart = new Date(dayStart);
  lookbackStart.setDate(lookbackStart.getDate() - 6);

  const velocityWindowStart = new Date(dayStart);
  velocityWindowStart.setDate(velocityWindowStart.getDate() - 6);

  const capacityWindowStart = new Date(dayStart);
  capacityWindowStart.setDate(capacityWindowStart.getDate() - 13);

  const blockerWindowStart = new Date(dayStart);
  blockerWindowStart.setDate(blockerWindowStart.getDate() - 29);

  const scopeChangeWindowStart = new Date(dayStart);
  scopeChangeWindowStart.setDate(scopeChangeWindowStart.getDate() - 6);

  const [
    members,
    dayEntries,
    recentEntries,
    entriesInCapacityWindow,
    qualitySnapshot,
    unresolvedActions,
    staleIssues,
    activeTaskCount,
    activeSprint,
    completedTransitions,
    blockerWindowEntries,
    actionStates,
    issueLinks,
    researchLinks,
    openIssues,
    openResearch,
    issueScopeChanges,
    projectAiSettings,
    suggestionStateRows,
    openActionStates,
  ] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      select: { userId: true, user: { select: { name: true, email: true } } },
    }),
    prisma.dailyStandupEntry.findMany({
      where: { projectId, date: { gte: dayStart, lte: dayEnd } },
      select: { id: true, userId: true, blockers: true },
    }),
    prisma.dailyStandupEntry.findMany({
      where: { projectId, date: { gte: lookbackStart, lte: dayEnd } },
      select: {
        id: true,
        userId: true,
        date: true,
        blockers: true,
        issues: { select: { issueId: true } },
      },
    }),
    prisma.dailyStandupEntry.findMany({
      where: { projectId, date: { gte: capacityWindowStart, lte: dayEnd } },
      select: {
        id: true,
        date: true,
        userId: true,
        issues: { select: { issueId: true } },
        research: { select: { researchItemId: true } },
      },
    }),
    prisma.standupQualityDaily.findUnique({
      where: { projectId_date: { projectId, date: dayStart } },
      select: { qualityScore: true },
    }),
    prisma.standupActionState.count({
      where: {
        projectId,
        date: { lte: dayEnd },
        state: { in: ["OPEN", "SNOOZED"] },
      },
    }),
    prisma.issue.findMany({
      where: {
        projectId,
        status: { not: IssueStatus.DONE },
        updatedAt: { lt: new Date(dayEnd.getTime() - 72 * 60 * 60 * 1000) },
      },
      select: { id: true, key: true, title: true, priority: true },
    }),
    prisma.issue.count({
      where: {
        projectId,
        status: { not: IssueStatus.DONE },
      },
    }),
    prisma.sprint.findFirst({
      where: {
        projectId,
        status: "ACTIVE",
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    }),
    prisma.issueHistory.findMany({
      where: {
        issue: { projectId },
        field: IssueHistoryField.STATUS,
        newValue: IssueStatus.DONE,
        createdAt: { gte: velocityWindowStart, lte: dayEnd },
      },
      select: { issueId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.dailyStandupEntry.findMany({
      where: {
        projectId,
        date: { gte: blockerWindowStart, lte: dayEnd },
        NOT: [{ blockers: null }, { blockers: "" }],
      },
      select: {
        id: true,
        userId: true,
        date: true,
        blockers: true,
        issues: { select: { issueId: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.standupActionState.findMany({
      where: {
        projectId,
        state: "DONE",
        updatedAt: { gte: blockerWindowStart, lte: dayEnd },
      },
      select: { createdAt: true, updatedAt: true },
    }),
    prisma.standupEntryIssueLink.findMany({
      where: {
        standupEntry: {
          projectId,
          date: { gte: capacityWindowStart, lte: dayEnd },
        },
      },
      select: {
        issueId: true,
        standupEntryId: true,
        standupEntry: { select: { userId: true, date: true } },
      },
    }),
    prisma.standupEntryResearchLink.findMany({
      where: {
        standupEntry: {
          projectId,
          date: { gte: capacityWindowStart, lte: dayEnd },
        },
      },
      select: {
        researchItemId: true,
        standupEntryId: true,
        standupEntry: { select: { userId: true, date: true } },
      },
    }),
    prisma.issue.findMany({
      where: {
        projectId,
        status: { not: IssueStatus.DONE },
      },
      select: { id: true, createdAt: true, type: true, sprintId: true },
    }),
    prisma.researchItem.findMany({
      where: {
        projectId,
        status: { not: ResearchStatus.COMPLETED },
      },
      select: { id: true, createdAt: true },
    }),
    prisma.issueHistory.findMany({
      where: {
        issue: { projectId },
        field: IssueHistoryField.SPRINT,
        createdAt: { gte: scopeChangeWindowStart, lte: dayEnd },
      },
      select: { oldValue: true, newValue: true },
    }),
    (prisma as any).projectAISettings?.findUnique
      ? (prisma as any).projectAISettings.findUnique({
          where: { projectId },
          select: { proactiveGuidanceEnabled: true },
        })
      : Promise.resolve(null),
    (prisma as any).sprintGuidanceSuggestionState?.findMany
      ? (prisma as any).sprintGuidanceSuggestionState.findMany({
          where: {
            projectId,
            userId: options.userId,
            date: dayStart,
          },
          select: { suggestionId: true, suggestionState: true, dismissedUntil: true, snoozedUntil: true },
        })
      : Promise.resolve([]),
    prisma.standupActionState.findMany({
      where: {
        projectId,
        userId: options.userId,
        date: { lte: dayEnd },
        state: { in: ["OPEN", "SNOOZED"] },
      },
      select: { actionId: true },
    }),
  ]);

  const teamSize = Math.max(1, members.length);
  const standupByUser = new Set(dayEntries.map((entry) => entry.userId));
  const missingStandupMembers = Math.max(0, members.length - standupByUser.size);

  const chains = new Map<string, Set<string>>();
  recentEntries.forEach((entry) => {
    const blockerText = entry.blockers?.trim();
    if (!blockerText) return;
    blockerText
      .split(/[.\n,;]+/)
      .map((snippet) => snippet.trim().toLowerCase())
      .filter((snippet) => snippet.length > 5)
      .forEach((snippet) => {
        const key = `${entry.userId}:${snippet}`;
        const dates = chains.get(key) ?? new Set<string>();
        dates.add(entry.date.toISOString().slice(0, 10));
        chains.set(key, dates);
      });
  });

  const blockerChains = Array.from(chains.entries()).filter(([, dates]) => dates.size >= 3);
  const persistentBlockersOver2Days = blockerChains.length;

  const blockerIssueIds = new Set(
    recentEntries.flatMap((entry) =>
      entry.blockers?.trim() ? entry.issues.map((issue) => issue.issueId) : []
    )
  );
  const staleIssueIds = new Set(staleIssues.map((issue) => issue.id));
  const overlappingStaleBlockedIssueCount = Array.from(staleIssueIds).filter((id) => blockerIssueIds.has(id)).length;

  const daysRemainingInSprint =
    activeSprint?.endDate
      ? Math.max(0, Math.ceil((activeSprint.endDate.getTime() - dayStart.getTime()) / (24 * 60 * 60 * 1000)))
      : null;

  const computation = computeSprintHealthScore({
    persistentBlockersOver2Days,
    missingStandupMembers,
    staleWorkCount: staleIssues.length,
    unresolvedActions,
    qualityScore: qualitySnapshot?.qualityScore ?? null,
    teamSize,
    activeTaskCount: Math.max(1, activeTaskCount),
    daysRemainingInSprint,
  });

  const doneByDay = new Map<string, number>();
  completedTransitions.forEach((transition) => {
    const key = transition.createdAt.toISOString().slice(0, 10);
    doneByDay.set(key, (doneByDay.get(key) ?? 0) + 1);
  });

  const velocityDates = buildDateRange(
    velocityWindowStart.toISOString().slice(0, 10),
    dayStart.toISOString().slice(0, 10)
  );
  const completedCounts = velocityDates.map((date) => doneByDay.get(date) ?? 0);
  const observedSampleDays = completedCounts.filter((value) => value > 0).length;
  const avgTasksCompletedPerDay = round2(
    completedCounts.reduce((sum, count) => sum + count, 0) / Math.max(1, completedCounts.length)
  );

  const velocityMean = avgTasksCompletedPerDay;
  const velocityVariance = completedCounts.reduce((sum, count) => sum + (count - velocityMean) ** 2, 0) /
    Math.max(1, completedCounts.length);
  const velocityStdDev = Math.sqrt(velocityVariance);
  const velocityStabilityScore = round2(
    Math.max(0, Math.min(1, velocityMean <= 0 ? 0 : 1 - velocityStdDev / Math.max(1, velocityMean + 1)))
  );

  const blockerResolutionHours: number[] = [];
  const blockerSpans = new Map<string, { first: Date; last: Date; dates: Set<string> }>();
  blockerWindowEntries.forEach((entry) => {
    const snippets = (entry.blockers ?? "")
      .split(/[.\n,;]+/)
      .map((snippet) => snippet.trim().toLowerCase())
      .filter((snippet) => snippet.length > 5);

    snippets.forEach((snippet) => {
      const key = `${entry.userId}:${snippet}`;
      const current = blockerSpans.get(key) ?? { first: entry.date, last: entry.date, dates: new Set<string>() };
      if (entry.date.getTime() < current.first.getTime()) current.first = entry.date;
      if (entry.date.getTime() > current.last.getTime()) current.last = entry.date;
      current.dates.add(entry.date.toISOString().slice(0, 10));
      blockerSpans.set(key, current);
    });
  });

  blockerSpans.forEach((span) => {
    if (span.dates.size < 2) return;
    if (span.last.getTime() >= dayStart.getTime()) return;
    blockerResolutionHours.push(round2((span.last.getTime() - span.first.getTime()) / (1000 * 60 * 60)));
  });

  const avgBlockerResolutionHours = blockerResolutionHours.length
    ? round2(blockerResolutionHours.reduce((sum, value) => sum + value, 0) / blockerResolutionHours.length)
    : null;

  const actionResolutionHours = actionStates
    .map((state) => round2((state.updatedAt.getTime() - state.createdAt.getTime()) / (1000 * 60 * 60)))
    .filter((hours) => hours >= 0);
  const avgActionResolutionHours = actionResolutionHours.length
    ? round2(actionResolutionHours.reduce((sum, value) => sum + value, 0) / actionResolutionHours.length)
    : null;

  const openIssueSet = new Set(openIssues.map((issue) => issue.id));
  const openResearchSet = new Set(openResearch.map((item) => item.id));
  const sprintScopeStart = activeSprint?.startDate ?? capacityWindowStart;

  const scopedIssueLinks = issueLinks.filter(
    (link) => link.standupEntry.date.getTime() >= sprintScopeStart.getTime()
  );
  const scopedResearchLinks = researchLinks.filter(
    (link) => link.standupEntry.date.getTime() >= sprintScopeStart.getTime()
  );

  const remainingLinkedIssueIds = new Set<string>();
  const remainingLinkedResearchIds = new Set<string>();

  scopedIssueLinks.forEach((link) => {
    if (!openIssueSet.has(link.issueId)) return;
    remainingLinkedIssueIds.add(link.issueId);
  });

  scopedResearchLinks.forEach((link) => {
    if (!openResearchSet.has(link.researchItemId)) return;
    remainingLinkedResearchIds.add(link.researchItemId);
  });

  const remainingLinkedWork = remainingLinkedIssueIds.size + remainingLinkedResearchIds.size;

  const issueMap = new Map<string, { createdAt: Date; type: string }>(
    openIssues.map((issue) => [issue.id, { createdAt: issue.createdAt, type: issue.type }] as const)
  );
  const researchMap = new Map<string, { createdAt: Date }>(
    openResearch.map((item) => [item.id, { createdAt: item.createdAt }] as const)
  );

  const issueTypeWeight = (type: string) => {
    if (type === "BUG") return 1.1;
    if (type === "STORY") return 1.35;
    return 1.0;
  };
  const ageWeight = (createdAt: Date) => {
    const ageDays = daysBetween(createdAt, dayEnd);
    if (ageDays >= 21) return 1.4;
    if (ageDays >= 10) return 1.2;
    if (ageDays >= 5) return 1.1;
    return 1.0;
  };

  const weightedRemainingWork = round2(
    Array.from(remainingLinkedIssueIds).reduce((sum, issueId) => {
      const issue = issueMap.get(issueId);
      if (!issue) return sum + 1;
      return sum + issueTypeWeight(issue.type) * ageWeight(issue.createdAt);
    }, 0) +
      Array.from(remainingLinkedResearchIds).reduce((sum, itemId) => {
        const item = researchMap.get(itemId);
        if (!item) return sum + 1;
        return sum + ageWeight(item.createdAt);
      }, 0)
  );

  const completionRatePerDay = Math.max(0.1, avgTasksCompletedPerDay);
  const projectedDaysToComplete = weightedRemainingWork / completionRatePerDay;
  const projectedCompletionDate = Number.isFinite(projectedDaysToComplete)
    ? new Date(dayStart.getTime() + Math.ceil(projectedDaysToComplete) * 24 * 60 * 60 * 1000)
    : null;

  const deliveryRisk = Boolean(
    activeSprint?.endDate && projectedCompletionDate && projectedCompletionDate.getTime() > activeSprint.endDate.getTime()
  );

  const openLinkedItemsByUser = new Map<string, Set<string>>();
  const lastLinkedDateByUser = new Map<string, Date>();
  scopedIssueLinks.forEach((link) => {
    const current = openLinkedItemsByUser.get(link.standupEntry.userId) ?? new Set<string>();
    if (openIssueSet.has(link.issueId)) {
      current.add(`issue:${link.issueId}`);
      openLinkedItemsByUser.set(link.standupEntry.userId, current);
    }
    const currentDate = lastLinkedDateByUser.get(link.standupEntry.userId);
    if (!currentDate || currentDate.getTime() < link.standupEntry.date.getTime()) {
      lastLinkedDateByUser.set(link.standupEntry.userId, link.standupEntry.date);
    }
  });
  scopedResearchLinks.forEach((link) => {
    const current = openLinkedItemsByUser.get(link.standupEntry.userId) ?? new Set<string>();
    if (openResearchSet.has(link.researchItemId)) {
      current.add(`research:${link.researchItemId}`);
      openLinkedItemsByUser.set(link.standupEntry.userId, current);
    }
    const currentDate = lastLinkedDateByUser.get(link.standupEntry.userId);
    if (!currentDate || currentDate.getTime() < link.standupEntry.date.getTime()) {
      lastLinkedDateByUser.set(link.standupEntry.userId, link.standupEntry.date);
    }
  });

  const blockerIssueCountByUser = new Map<string, Set<string>>();
  const blockerEntryIdsByUser = new Map<string, Set<string>>();
  blockerWindowEntries
    .filter((entry) => entry.date.getTime() >= velocityWindowStart.getTime())
    .forEach((entry) => {
      if (!entry.blockers?.trim()) return;
      const currentIssues = blockerIssueCountByUser.get(entry.userId) ?? new Set<string>();
      const currentEntries = blockerEntryIdsByUser.get(entry.userId) ?? new Set<string>();
      entry.issues.forEach((issue) => currentIssues.add(issue.issueId));
      currentEntries.add(entry.id);
      blockerIssueCountByUser.set(entry.userId, currentIssues);
      blockerEntryIdsByUser.set(entry.userId, currentEntries);
    });

  const capacitySignals = members.flatMap((member) => {
    const name = member.user.name || member.user.email || member.userId;
    const openItems = openLinkedItemsByUser.get(member.userId)?.size ?? 0;
    const blockedItems = blockerIssueCountByUser.get(member.userId)?.size ?? 0;
    const idleDays = daysBetween(lastLinkedDateByUser.get(member.userId) ?? capacityWindowStart, dayEnd);

    const evidenceEntryIds = Array.from(
      new Set(
        scopedIssueLinks
          .filter((link) => link.standupEntry.userId === member.userId)
          .map((link) => link.standupEntryId)
          .concat(
            scopedResearchLinks
              .filter((link) => link.standupEntry.userId === member.userId)
              .map((link) => link.standupEntryId)
          )
      )
    ).slice(0, 8) as string[];

    const evidenceLinkedWorkIds = Array.from(
      new Set(
        (openLinkedItemsByUser.get(member.userId)
          ? Array.from(openLinkedItemsByUser.get(member.userId) ?? [])
          : [])
      )
    ).slice(0, 12) as string[];

    const signals = [] as Array<{
      userId: string;
      name: string;
      type: "OVERLOADED" | "MULTI_BLOCKED" | "IDLE";
      openItems: number;
      blockedItems: number;
      idleDays: number;
      thresholds: { openItems: number; blockedItems: number; idleDays: number };
      evidence: { entryIds: string[]; linkedWorkIds: string[] };
      message: string;
    }>;

    if (openItems > CAPACITY_THRESHOLDS.openItems) {
      signals.push({
        userId: member.userId,
        name,
        type: "OVERLOADED",
        openItems,
        blockedItems,
        idleDays,
        thresholds: CAPACITY_THRESHOLDS,
        evidence: { entryIds: evidenceEntryIds, linkedWorkIds: evidenceLinkedWorkIds },
        message: `${name} has ${openItems} open linked items (> ${CAPACITY_THRESHOLDS.openItems}).`,
      });
    }

    if (blockedItems >= CAPACITY_THRESHOLDS.blockedItems) {
      signals.push({
        userId: member.userId,
        name,
        type: "MULTI_BLOCKED",
        openItems,
        blockedItems,
        idleDays,
        thresholds: CAPACITY_THRESHOLDS,
        evidence: {
          entryIds: Array.from(blockerEntryIdsByUser.get(member.userId) ?? []).slice(0, 8) as string[],
          linkedWorkIds: Array.from(blockerIssueCountByUser.get(member.userId) ?? [])
            .map((id) => `issue:${id}`)
            .slice(0, 12),
        },
        message: `${name} is blocked on ${blockedItems} linked tasks.`,
      });
    }

    if (openItems === 0 && idleDays >= CAPACITY_THRESHOLDS.idleDays) {
      signals.push({
        userId: member.userId,
        name,
        type: "IDLE",
        openItems,
        blockedItems,
        idleDays,
        thresholds: CAPACITY_THRESHOLDS,
        evidence: { entryIds: evidenceEntryIds, linkedWorkIds: evidenceLinkedWorkIds },
        message: `${name} has had no linked work for ${idleDays} days.`,
      });
    }

    return signals;
  });

  let addedWorkCount = 0;
  let removedWorkCount = 0;
  issueScopeChanges.forEach((change) => {
    const oldValue = (change.oldValue ?? "").toString().trim();
    const newValue = (change.newValue ?? "").toString().trim();
    if (!oldValue && newValue) addedWorkCount += 1;
    if (oldValue && !newValue) removedWorkCount += 1;
    if (oldValue && newValue && oldValue !== newValue) {
      addedWorkCount += 1;
      removedWorkCount += 1;
    }
  });

  const blockerCountsByDay = new Map<string, number>();
  blockerWindowEntries.forEach((entry) => {
    const key = entry.date.toISOString().slice(0, 10);
    blockerCountsByDay.set(key, (blockerCountsByDay.get(key) ?? 0) + 1);
  });
  const blockerDailyValues = velocityDates.map((date) => blockerCountsByDay.get(date) ?? 0);
  const blockerMean = blockerDailyValues.reduce((sum, count) => sum + count, 0) / Math.max(1, blockerDailyValues.length);
  const blockerVariance = blockerDailyValues.reduce((sum, count) => sum + (count - blockerMean) ** 2, 0) / Math.max(1, blockerDailyValues.length);
  const blockerVolatility = Math.sqrt(blockerVariance);
  const blockerVolatilityScore = round2(Math.max(0, Math.min(1, 1 - blockerVolatility / Math.max(1, blockerMean + 1))));

  const entriesWithLinkedWork = entriesInCapacityWindow.filter(
    (entry) => entry.issues.length > 0 || entry.research.length > 0
  ).length;
  const linkedWorkCoverage = round2(
    entriesWithLinkedWork / Math.max(1, entriesInCapacityWindow.length)
  );

  const qualityParts = [
    qualitySnapshot?.qualityScore !== undefined ? Math.max(0, Math.min(1, qualitySnapshot.qualityScore / 100)) : 0.5,
    Math.max(0, Math.min(1, dayEntries.length / Math.max(1, members.length))),
    Math.max(0, Math.min(1, (avgTasksCompletedPerDay + 1) / (remainingLinkedWork + avgTasksCompletedPerDay + 1))),
    linkedWorkCoverage,
  ];
  const dataQualityScore = round2(qualityParts.reduce((sum, value) => sum + value, 0) / qualityParts.length);

  const scopeChurnRatio = round2((addedWorkCount + removedWorkCount) / Math.max(1, remainingLinkedWork + completedCounts.reduce((a, b) => a + b, 0)));
  const scopeChurnPenalty = Math.min(0.2, scopeChurnRatio * 0.25);

  const weightedConfidence =
    dataQualityScore * FORECAST_CONFIDENCE_WEIGHTS.dataQuality +
    velocityStabilityScore * FORECAST_CONFIDENCE_WEIGHTS.velocityStability +
    blockerVolatilityScore * FORECAST_CONFIDENCE_WEIGHTS.blockerVolatility +
    linkedWorkCoverage * FORECAST_CONFIDENCE_WEIGHTS.linkedCoverage;

  const adjustedConfidence = Math.max(0, weightedConfidence - scopeChurnPenalty);

  let forecastConfidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
  if (
    observedSampleDays >= FORECAST_CONFIDENCE_THRESHOLDS.minimumSampleDays &&
    adjustedConfidence >= FORECAST_CONFIDENCE_THRESHOLDS.high
  ) {
    forecastConfidence = "HIGH";
  } else if (
    observedSampleDays >= FORECAST_CONFIDENCE_THRESHOLDS.minimumSampleDays &&
    adjustedConfidence >= FORECAST_CONFIDENCE_THRESHOLDS.medium
  ) {
    forecastConfidence = "MEDIUM";
  }

  const projectionDefinitions = {
    modelVersion: PROJECTION_MODEL_VERSION,
    completionDefinition: "Issue completion is counted only by ISSUE_HISTORY status transition to DONE.",
    remainingWorkDefinition: activeSprint?.id
      ? "Open linked work includes issue/research items linked via standups since sprint start for the active sprint scope."
      : "Open linked work includes issue/research items linked via standups in the last 14 days.",
    weightingModel: "Weighted by issue type and work-item age buckets; unlinked work is excluded from projection.",
    warning: "Projection is linkage-dependent and excludes unlinked backlog work.",
    confidenceWeights: FORECAST_CONFIDENCE_WEIGHTS,
    confidenceThresholds: FORECAST_CONFIDENCE_THRESHOLDS,
    capacityThresholds: CAPACITY_THRESHOLDS,
  };

  const prismaAny = prisma as any;

  await prismaAny.sprintVelocitySnapshot?.upsert?.({
    where: { projectId_date: { projectId, date: dayStart } },
    create: {
      projectId,
      sprintId: activeSprint?.id ?? null,
      date: dayStart,
      avgTasksCompletedPerDay,
      avgBlockerResolutionHours,
      avgActionResolutionHours,
      completionRatePerDay,
      remainingLinkedWork,
      projectedCompletionDate,
      deliveryRisk,
      capacitySignalsJson: capacitySignals,
      forecastConfidence,
      dataQualityScore,
      velocityStabilityScore,
      blockerVolatilityScore,
      projectionModelVersion: PROJECTION_MODEL_VERSION,
      projectionDefinitionsJson: projectionDefinitions,
    },
    update: {
      sprintId: activeSprint?.id ?? null,
      avgTasksCompletedPerDay,
      avgBlockerResolutionHours,
      avgActionResolutionHours,
      completionRatePerDay,
      remainingLinkedWork,
      projectedCompletionDate,
      deliveryRisk,
      capacitySignalsJson: capacitySignals,
      forecastConfidence,
      dataQualityScore,
      velocityStabilityScore,
      blockerVolatilityScore,
      projectionModelVersion: PROJECTION_MODEL_VERSION,
      projectionDefinitionsJson: projectionDefinitions,
    },
  });

  const evidenceByType = {
    BLOCKER_CLUSTER: blockerChains.map(([key]) => key).slice(0, 6),
    MISSING_STANDUP: members
      .map((member) => member.userId)
      .filter((id) => !standupByUser.has(id))
      .slice(0, 6),
    STALE_WORK: staleIssues.map((issue) => issue.id).slice(0, 10),
    LOW_QUALITY_INPUT:
      qualitySnapshot?.qualityScore !== undefined
        ? [`quality:${qualitySnapshot.qualityScore}`]
        : [],
    UNRESOLVED_ACTIONS: [`count:${unresolvedActions}`],
    END_OF_SPRINT_PRESSURE:
      daysRemainingInSprint !== null
        ? [`daysRemaining:${daysRemainingInSprint}`]
        : [],
    OVERLAP_DEDUP_CREDIT: [`overlapIssueCount:${overlappingStaleBlockedIssueCount}`],
    DELIVERY_RISK: [
      `projectedCompletion:${projectedCompletionDate?.toISOString().slice(0, 10) ?? "n/a"}`,
      `sprintEnd:${activeSprint?.endDate?.toISOString().slice(0, 10) ?? "n/a"}`,
    ],
  } as const;

  const riskDrivers = computation.riskDrivers.map((driver) => ({
    ...driver,
    evidence: [...evidenceByType[driver.type]],
  }));

  if (deliveryRisk) {
    riskDrivers.push({
      type: "DELIVERY_RISK",
      impact: -10,
      evidence: [...evidenceByType.DELIVERY_RISK],
    });
  }

  const suggestionStateById = new Map<string, { state: "OPEN" | "ACCEPTED" | "DISMISSED" | "SNOOZED"; dismissedUntil: string | null; snoozedUntil: string | null }>(
    suggestionStateRows.map((row: { suggestionId: string; suggestionState: "OPEN" | "ACCEPTED" | "DISMISSED" | "SNOOZED"; dismissedUntil: Date | null; snoozedUntil: Date | null }) => [
      row.suggestionId,
      {
        state: row.suggestionState,
        dismissedUntil: row.dismissedUntil ? row.dismissedUntil.toISOString() : null,
        snoozedUntil: row.snoozedUntil ? row.snoozedUntil.toISOString() : null,
      },
    ])
  );

  const proactiveGuidance = buildProactiveSprintGuidance({
    capacitySignals,
    riskDrivers,
    staleIssues,
    persistentBlockersOver2Days,
    qualityScore: qualitySnapshot?.qualityScore ?? null,
    unresolvedActions,
    deliveryRisk,
    forecastConfidence,
    velocitySampleDays: observedSampleDays,
    openActionIds: openActionStates.map((state) => state.actionId),
    projectRole: options.projectRole,
    suggestionStateById,
    proactiveGuidanceEnabled: projectAiSettings?.proactiveGuidanceEnabled ?? false,
  });

  const negativeImpacts = riskDrivers
    .filter((driver) => driver.impact < 0)
    .map((driver) => Math.abs(driver.impact));
  const totalNegativeImpact = negativeImpacts.reduce((sum, value) => sum + value, 0);
  const maxSingleImpact = negativeImpacts.length ? Math.max(...negativeImpacts) : 0;
  const concentrationIndex = totalNegativeImpact > 0 ? round2(maxSingleImpact / totalNegativeImpact) : 0;

  await prismaAny.sprintHealthDaily.upsert({
    where: { projectId_date: { projectId, date: dayStart } },
    create: {
      projectId,
      date: dayStart,
      healthScore: computation.healthScore,
      status: computation.status,
      confidenceLevel: computation.confidenceLevel,
      scoreBreakdown: computation.scoreBreakdown,
      riskDrivers,
      staleWorkCount: staleIssues.length,
      missingStandups: missingStandupMembers,
      persistentBlockers: persistentBlockersOver2Days,
      unresolvedActions,
      qualityScore: qualitySnapshot?.qualityScore ?? null,
      probabilities: {
        ...computation.probabilities,
        probabilityModel: computation.probabilityModel,
        confidenceBasis: computation.confidenceBasis,
        normalizedMetrics: computation.normalizedMetrics,
        concentrationIndex,
      },
      scoringModelVersion: computation.scoringModelVersion,
    },
    update: {
      healthScore: computation.healthScore,
      status: computation.status,
      confidenceLevel: computation.confidenceLevel,
      scoreBreakdown: computation.scoreBreakdown,
      riskDrivers,
      staleWorkCount: staleIssues.length,
      missingStandups: missingStandupMembers,
      persistentBlockers: persistentBlockersOver2Days,
      unresolvedActions,
      qualityScore: qualitySnapshot?.qualityScore ?? null,
      probabilities: {
        ...computation.probabilities,
        probabilityModel: computation.probabilityModel,
        confidenceBasis: computation.confidenceBasis,
        normalizedMetrics: computation.normalizedMetrics,
        concentrationIndex,
      },
      scoringModelVersion: computation.scoringModelVersion,
    },
  });

  return {
    date: dateIso,
    ...computation,
    riskDrivers,
    staleWorkCount: staleIssues.length,
    missingStandupMembers,
    persistentBlockersOver2Days,
    unresolvedActions,
    qualityScore: qualitySnapshot?.qualityScore ?? null,
    concentrationIndex,
    velocitySnapshot: {
      avgTasksCompletedPerDay,
      avgBlockerResolutionHours,
      avgActionResolutionHours,
      completionRatePerDay,
      remainingLinkedWork,
      weightedRemainingWork,
      projectedCompletionDate: projectedCompletionDate ? projectedCompletionDate.toISOString() : null,
      deliveryRisk,
      linkedWorkCoverage,
      sampleSizeDays: observedSampleDays,
      scopeAddedWorkCount: addedWorkCount,
      scopeRemovedWorkCount: removedWorkCount,
      scopeChangeSummary: `Scope changed by +${addedWorkCount} / -${removedWorkCount} items in the last 7 days.`,
      sprint: {
        id: activeSprint?.id ?? null,
        name: activeSprint?.name ?? null,
        startDate: activeSprint?.startDate ? activeSprint.startDate.toISOString() : null,
        endDate: activeSprint?.endDate ? activeSprint.endDate.toISOString() : null,
      },
      projectionDefinitions,
      projectionModelVersion: PROJECTION_MODEL_VERSION,
      unweightedProjectionWarning: true,
    },
    capacitySignals,
    forecastConfidence,
    proactiveGuidanceEnabled: projectAiSettings?.proactiveGuidanceEnabled ?? false,
    reallocationSuggestions: proactiveGuidance.reallocationSuggestions,
    scopeAdjustmentSuggestions: proactiveGuidance.scopeAdjustmentSuggestions,
    meetingOptimizationSuggestions: proactiveGuidance.meetingOptimizationSuggestions,
    executiveView: proactiveGuidance.executiveView,
  };
};

export const fetchSprintHealthReport = async (
  filters: ReportFilters,
  options: { userId: string; projectRole: "ADMIN" | "PO" | "DEV" | "QA" | "VIEWER" | null }
): Promise<SprintHealthReport> => {
  const trendDates = buildDateRange(
    new Date(new Date(`${filters.to}T00:00:00.000Z`).getTime() - 13 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    filters.to
  );

  const computed = await Promise.all(
    trendDates.map((dateIso) => computeDailySprintHealth(filters.projectId, dateIso, options))
  );

  const smoothedTrend = computed.map((day, index) => {
    const window = computed.slice(Math.max(0, index - 2), index + 1);
    const average =
      window.reduce((sum, item) => sum + item.healthScore, 0) / Math.max(1, window.length);
    return {
      date: day.date,
      healthScore: round2(average),
      status: toModelStatus(round2(average)),
    };
  });

  const latest = computed[computed.length - 1];
  const previous = computed[computed.length - 2];
  const latestSmooth = smoothedTrend[smoothedTrend.length - 1];
  const previousSmooth = smoothedTrend[smoothedTrend.length - 2] ?? latestSmooth;

  const rawDelta = latest.riskDrivers.length - (previous?.riskDrivers.length ?? latest.riskDrivers.length);
  const riskDeltaSinceYesterday = Math.abs(rawDelta) <= 2 ? 0 : rawDelta;

  const smoothDelta = latestSmooth.healthScore - previousSmooth.healthScore;
  const trendIndicator =
    smoothDelta > 2
      ? "IMPROVED"
      : smoothDelta < -2
        ? "DEGRADED"
        : "UNCHANGED";

  const projectedSeries = computed
    .map((day) => day.velocitySnapshot.projectedCompletionDate)
    .filter((value): value is string => Boolean(value))
    .slice(-3)
    .map((value) => new Date(value).getTime());
  const smoothedProjectedCompletionDate = projectedSeries.length
    ? new Date(
        projectedSeries.reduce((sum, value) => sum + value, 0) / projectedSeries.length
      ).toISOString()
    : latest.velocitySnapshot.projectedCompletionDate;
  const projectedDateDeltaDays =
    latest.velocitySnapshot.projectedCompletionDate && previous?.velocitySnapshot.projectedCompletionDate
      ? daysBetween(
          new Date(previous.velocitySnapshot.projectedCompletionDate),
          new Date(latest.velocitySnapshot.projectedCompletionDate)
        )
      : 0;

  return {
    date: latest.date,
    healthScore: latest.healthScore,
    smoothedHealthScore: latestSmooth.healthScore,
    status: latest.status,
    confidenceLevel: latest.confidenceLevel,
    confidenceBasis: latest.confidenceBasis,
    scoreBreakdown: latest.scoreBreakdown,
    riskDrivers: latest.riskDrivers,
    probabilities: latest.probabilities,
    probabilityModel: latest.probabilityModel,
    normalizedMetrics: latest.normalizedMetrics,
    scoringModelVersion: latest.scoringModelVersion,
    riskConcentrationAreas: buildRiskConcentrationAreas(latest.riskDrivers),
    concentrationIndex: latest.concentrationIndex,
    staleWorkCount: latest.staleWorkCount,
    missingStandupMembers: latest.missingStandupMembers,
    persistentBlockersOver2Days: latest.persistentBlockersOver2Days,
    unresolvedActions: latest.unresolvedActions,
    qualityScore: latest.qualityScore,
    trend14d: smoothedTrend,
    riskDeltaSinceYesterday,
    trendIndicator,
    velocitySnapshot: {
      ...latest.velocitySnapshot,
      projectedCompletionDateSmoothed: smoothedProjectedCompletionDate,
      projectedDateDeltaDays,
    },
    capacitySignals: latest.capacitySignals,
    forecastConfidence: latest.forecastConfidence,
    proactiveGuidanceEnabled: latest.proactiveGuidanceEnabled,
    reallocationSuggestions: latest.reallocationSuggestions,
    scopeAdjustmentSuggestions: latest.scopeAdjustmentSuggestions,
    meetingOptimizationSuggestions: latest.meetingOptimizationSuggestions,
    executiveView: latest.executiveView,
  };
};

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "to",
  "of",
  "in",
  "for",
  "on",
  "at",
  "with",
  "is",
  "it",
  "this",
  "that",
  "these",
  "those",
  "i",
  "we",
  "they",
  "you",
  "my",
  "our",
  "their",
  "was",
  "were",
  "am",
  "are",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "from",
  "by",
  "as",
  "about",
  "too",
  "so",
  "but",
  "if",
  "or",
  "not",
  "no",
  "can",
  "could",
  "should",
  "would",
  "will",
  "just",
  "them",
  "then",
  "than",
  "when",
  "what",
  "which",
  "while",
  "because",
  "been",
]);

type ThemeDefinition = {
  theme: string;
  keywords: string[];
};

const THEME_DEFINITIONS: ThemeDefinition[] = [
  { theme: "Dependencies & Waiting", keywords: ["dependency", "dependencies", "waiting", "blocked", "pending"] },
  { theme: "Access & Permissions", keywords: ["access", "permission", "permissions", "credential", "login"] },
  { theme: "Reviews & Approvals", keywords: ["review", "approval", "approve", "pr", "pull", "merge"] },
  { theme: "Environment & Deploys", keywords: ["env", "environment", "deploy", "deployment", "server", "staging", "prod"] },
  { theme: "Testing & Quality", keywords: ["test", "tests", "qa", "flaky", "regression", "bug"] },
  { theme: "API & Backend", keywords: ["api", "service", "endpoint", "prisma", "db", "database"] },
];

const normalizeSnippet = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part && !STOPWORDS.has(part))
    .join(" ");

const matchThemes = (snippet: string) => {
  const normalized = normalizeSnippet(snippet);
  const matches: string[] = [];

  for (const def of THEME_DEFINITIONS) {
    if (def.keywords.some((keyword) => new RegExp(`\\b${keyword}\w*\\b`).test(normalized))) {
      matches.push(def.theme);
    }
  }

  if (!matches.length && normalized) {
    matches.push("Other");
  }

  return matches;
};

const trimExample = (value: string) => {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
};

export const fetchBlockerThemes = async (
  filters: ReportFilters
): Promise<BlockerTheme[]> => {
  try {
    const entries = await prisma.dailyStandupEntry.findMany({
      where: {
        projectId: filters.projectId,
        date: {
          gte: toDateOnly(filters.from),
          lte: toDateOnly(filters.to),
        },
        blockers: { not: null },
      },
      select: {
        blockers: true,
      },
    });

    const themes = new Map<string, { count: number; examples: string[] }>();

    for (const entry of entries) {
      const blockerText = entry.blockers?.trim();
      if (!blockerText) continue;

      const snippets = blockerText
        .split(/\n|\.|;/)
        .map((part) => part.trim())
        .filter(Boolean);

      for (const snippet of snippets) {
        const matches = matchThemes(snippet);
        if (!matches.length) continue;

        for (const theme of matches) {
          const existing = themes.get(theme) ?? { count: 0, examples: [] };
          existing.count += 1;
          if (existing.examples.length < 3) {
            existing.examples.push(trimExample(snippet));
          }
          themes.set(theme, existing);
        }
      }
    }

    if (!themes.size) {
      return [
        {
          theme: "No blockers reported",
          count: 0,
          examples: [],
        },
      ];
    }

    return Array.from(themes.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([theme, value]) => ({
        theme,
        count: value.count,
        examples: value.examples,
      }));
  } catch (error) {
    logError("Failed to fetch blocker themes", error);
    return [
      {
        theme: "Unable to load blocker themes",
        count: 0,
        examples: [],
      },
    ];
  }
};
