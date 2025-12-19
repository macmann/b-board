import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { Role } from "@/lib/prismaEnums";

type UserSummary = {
  userId: string;
  name: string;
  email: string | null;
  updateCount: number;
  lastUpdate: string | null;
};

type UserAdoptionResponse = {
  activeUsers: number;
  totalUsers: number;
  activeUserRate: number;
  standupCoverage: number;
  avgUpdatesPerUser: number;
  lateUpdateRate: number;
  topContributors: UserSummary[];
  users: UserSummary[];
};

const DEFAULT_RANGE_DAYS = 30;

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
};

const getDateRange = (searchParams: URLSearchParams) => {
  const today = new Date();
  const defaultTo = endOfDay(today);

  const defaultFrom = new Date(defaultTo);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - (DEFAULT_RANGE_DAYS - 1));

  const parsedFrom = parseDateOnly(searchParams.get("from"));
  const parsedTo = parseDateOnly(searchParams.get("to"));

  const from = parsedFrom ? startOfDay(parsedFrom) : defaultFrom;
  const to = parsedTo ? endOfDay(parsedTo) : defaultTo;

  if (to < from) {
    return { from: defaultFrom, to: defaultTo };
  }

  return { from, to };
};

const getAccessibleProjectIds = async (
  user: { id: string; role: Role },
  requestedProjectId: string | null
) => {
  if (user.role === Role.ADMIN || user.role === Role.PO) {
    return requestedProjectId ? [requestedProjectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjects = memberships.map((membership) => membership.projectId);

  if (requestedProjectId) {
    return memberProjects.includes(requestedProjectId)
      ? [requestedProjectId]
      : ([] as string[]);
  }

  return memberProjects;
};

const formatDateOnly = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : null;

const buildWeekdaySet = (from: Date, to: Date) => {
  const dates = new Set<string>();
  const cursor = startOfDay(from);

  while (cursor.getTime() <= to.getTime()) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.add(formatDateOnly(cursor) as string);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const requestedProjectId = searchParams.get("projectId");
  const projectId = requestedProjectId === "all" ? null : requestedProjectId;

  const accessibleProjects = await getAccessibleProjectIds(user, projectId);

  if (Array.isArray(accessibleProjects) && accessibleProjects.length === 0) {
    return NextResponse.json({ ok: false, message: "No access to requested project" }, { status: 403 });
  }

  const { from, to } = getDateRange(searchParams);

  const standupWhere = {
    date: { gte: from, lte: to },
    ...(projectId
      ? { projectId }
      : accessibleProjects
        ? { projectId: { in: accessibleProjects } }
        : {}),
  } as const;

  const projectMemberWhere = projectId
    ? { projectId }
    : accessibleProjects
      ? { projectId: { in: accessibleProjects } }
      : {};

  const [standups, members] = await Promise.all([
    prisma.dailyStandupEntry.findMany({
      where: standupWhere,
      select: {
        id: true,
        userId: true,
        date: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.projectMember.findMany({
      where: projectMemberWhere,
      select: { userId: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const userMap = new Map<string, { name: string; email: string | null }>();

  members.forEach((member) => {
    userMap.set(member.userId, {
      name: member.user.name,
      email: member.user.email,
    });
  });

  standups.forEach((entry) => {
    if (!userMap.has(entry.userId)) {
      userMap.set(entry.userId, {
        name: entry.user.name,
        email: entry.user.email,
      });
    }
  });

  const totalUsers = userMap.size;
  const updatesByUser = new Map<string, { count: number; lastUpdate: Date }>();
  const standupDates = new Set<string>();

  let lateUpdates = 0;

  standups.forEach((entry) => {
    const existing = updatesByUser.get(entry.userId) ?? { count: 0, lastUpdate: entry.createdAt };
    const latest = existing.lastUpdate > entry.createdAt ? existing.lastUpdate : entry.createdAt;
    updatesByUser.set(entry.userId, { count: existing.count + 1, lastUpdate: latest });

    const createdHour = entry.createdAt.getHours();
    if (createdHour >= 12) {
      lateUpdates += 1;
    }

    standupDates.add(formatDateOnly(entry.date) as string);
  });

  const activeUsers = updatesByUser.size;
  const totalUpdates = standups.length;

  const weekdayDates = buildWeekdaySet(from, to);
  const weekdaysWithStandups = Array.from(weekdayDates).filter((date) =>
    standupDates.has(date)
  ).length;

  const standupCoverage = weekdayDates.size === 0 ? 0 : weekdaysWithStandups / weekdayDates.size;

  const users: UserSummary[] = Array.from(userMap.entries())
    .map(([userId, info]) => {
      const stats = updatesByUser.get(userId);
      return {
        userId,
        name: info.name,
        email: info.email,
        updateCount: stats?.count ?? 0,
        lastUpdate: formatDateOnly(stats?.lastUpdate) ?? null,
      };
    })
    .sort((a, b) => {
      if (b.updateCount !== a.updateCount) return b.updateCount - a.updateCount;
      return a.name.localeCompare(b.name);
    });

  const topContributors = users
    .filter((user) => user.updateCount > 0)
    .slice(0, 5);

  const response: UserAdoptionResponse = {
    activeUsers,
    totalUsers,
    activeUserRate: totalUsers === 0 ? 0 : activeUsers / totalUsers,
    standupCoverage,
    avgUpdatesPerUser: totalUsers === 0 ? 0 : totalUpdates / totalUsers,
    lateUpdateRate: totalUpdates === 0 ? 0 : lateUpdates / totalUpdates,
    topContributors,
    users,
  };

  return NextResponse.json(response);
}
