import { Role } from "@/lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";

type StandupInsightsResponse = {
  daily: Array<{
    date: string;
    updatesCount: number;
    blockersCount: number;
    dependenciesCount: number;
    summary?: string | null;
  }>;
  topBlockers: Array<{ text: string; count: number }>;
  topDependencies: Array<{ text: string; count: number }>;
  missingUpdates: Array<{ userId: string; name: string; missingDays: number }>;
};

const parseDateParam = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateOnly = (value: Date) => value.toISOString().slice(0, 10);

const splitPhrases = (input?: string | null) => {
  if (!input) return [] as string[];

  return input
    .split(/[\n\r;\-,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const addToCounts = (
  phrases: string[],
  map: Map<string, { text: string; count: number }>
) => {
  phrases.forEach((phrase) => {
    const key = phrase.toLowerCase();
    const current = map.get(key);
    if (current) {
      current.count += 1;
    } else {
      map.set(key, { text: phrase, count: 1 });
    }
  });
};

const getAllowedProjectIds = async (
  user: { id: string; role: Role },
  projectId: string | null
) => {
  if (user.role === Role.ADMIN) {
    return projectId ? [projectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjects = memberships.map((membership) => membership.projectId);

  if (projectId) {
    if (!memberProjects.includes(projectId)) {
      return [];
    }
    return [projectId];
  }

  return memberProjects;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));
  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== "all" ? projectParam : null;

  if (!from || !to || to < from) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  const allowedProjectIds = await getAllowedProjectIds(user, projectId);

  if (allowedProjectIds && allowedProjectIds.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const whereClause = {
    date: { gte: from, lte: to },
    ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
  } as const;

  const [entries, attendance, summaries] = await Promise.all([
    prisma.dailyStandupEntry.findMany({
      where: whereClause,
      select: {
        date: true,
        blockers: true,
        dependencies: true,
      },
    }),
    prisma.standupAttendance.findMany({
      where: {
        ...whereClause,
        status: "ABSENT",
      },
      include: { user: true },
    }),
    prisma.standupSummary.findMany({
      where: whereClause,
      select: { date: true, summary: true },
    }),
  ]);

  const dateCursor = new Date(from);
  const dailyMap = new Map<string, StandupInsightsResponse["daily"][number]>();

  while (dateCursor <= to) {
    const key = formatDateOnly(dateCursor);
    dailyMap.set(key, {
      date: key,
      updatesCount: 0,
      blockersCount: 0,
      dependenciesCount: 0,
      summary: null,
    });

    dateCursor.setDate(dateCursor.getDate() + 1);
  }

  const blockerCounts = new Map<string, { text: string; count: number }>();
  const dependencyCounts = new Map<string, { text: string; count: number }>();

  entries.forEach((entry) => {
    const key = formatDateOnly(entry.date);
    const existing = dailyMap.get(key);

    if (!existing) return;

    const blockerPhrases = splitPhrases(entry.blockers);
    const dependencyPhrases = splitPhrases(entry.dependencies);

    existing.updatesCount += 1;
    existing.blockersCount += blockerPhrases.length;
    existing.dependenciesCount += dependencyPhrases.length;

    addToCounts(blockerPhrases, blockerCounts);
    addToCounts(dependencyPhrases, dependencyCounts);
  });

  summaries.forEach((summary) => {
    const key = formatDateOnly(summary.date);
    const existing = dailyMap.get(key);

    if (existing) {
      existing.summary = existing.summary
        ? `${existing.summary}\n\n${summary.summary}`
        : summary.summary;
    }
  });

  const missingMap = new Map<string, { userId: string; name: string; missingDays: number }>();

  attendance.forEach((record) => {
    if (!record.userId) return;

    const current = missingMap.get(record.userId);
    const name =
      record.user?.name || record.user?.email || record.userId || "Unknown user";

    if (current) {
      current.missingDays += 1;
    } else {
      missingMap.set(record.userId, { userId: record.userId, name, missingDays: 1 });
    }
  });

  const response: StandupInsightsResponse = {
    daily: Array.from(dailyMap.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    ),
    topBlockers: Array.from(blockerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    topDependencies: Array.from(dependencyCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    missingUpdates: Array.from(missingMap.values()).sort(
      (a, b) => b.missingDays - a.missingDays
    ),
  };

  return NextResponse.json(response);
}
