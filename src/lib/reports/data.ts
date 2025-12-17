import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import {
  IssueHistoryField,
  IssueStatus,
} from "@/lib/prismaEnums";

import {
  BlockerTheme,
  BurndownPoint,
  CycleTimePoint,
  CycleTimeReport,
  ReportFilters,
  StandupInsight,
  VelocityPoint,
} from "./dto";

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
): Promise<StandupInsight[]> => {
  const [entries, summaries] = await Promise.all([
    prisma.dailyStandupEntry.findMany({
      where: {
        projectId: filters.projectId,
        date: {
          gte: toDateOnly(filters.from),
          lte: toDateOnly(filters.to),
        },
      },
      select: {
        date: true,
        blockers: true,
        dependencies: true,
      },
      orderBy: { date: "asc" },
    }),
    prisma.standupSummary.findMany({
      where: {
        projectId: filters.projectId,
        date: {
          gte: toDateOnly(filters.from),
          lte: toDateOnly(filters.to),
        },
      },
      select: {
        date: true,
        summary: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const dates = buildDateRange(filters.from, filters.to);

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

  return dates.map((date) => {
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

    const topBlockers = Array.from(new Set(blockerPhrases)).slice(0, 3);
    const summary = summariesByDate.get(date);

    return {
      date,
      blockersCount: blockers.length,
      dependenciesCount: dayEntries.filter((entry) => entry.dependencies?.trim()).length,
      updatesCount: dayEntries.length,
      topBlockers,
      hasAiSummary: Boolean(summary),
      summary,
      summaryExcerpt: summary ? excerpt(summary) : undefined,
    };
  });
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

