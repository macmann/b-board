import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { Role } from "@/lib/prismaEnums";

type ActivityType = "issue_created" | "issue_updated" | "standup";

type ActivityRecord = {
  projectId: string;
  at: Date;
  type: ActivityType;
};

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseInactiveDays = (value: string | null) => {
  if (!value) return 14;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 14 : parsed;
};

const getAllowedProjectIds = async (
  user: { id: string; role: Role },
  projectId: string | null
) => {
  const leadershipRoles = new Set<Role>([Role.ADMIN, Role.PO]);

  if (leadershipRoles.has(user.role)) {
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

const addActivityRecord = (
  map: Map<string, ActivityRecord>,
  record: ActivityRecord
) => {
  const current = map.get(record.projectId);

  if (!current || record.at > current.at) {
    map.set(record.projectId, record);
  }
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateOnly(searchParams.get("from"));
  const to = parseDateOnly(searchParams.get("to"));
  const inactiveDays = parseInactiveDays(searchParams.get("inactiveDays"));
  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== "all" ? projectParam : null;

  if (!from || !to || to < from) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  const allowedProjectIds = await getAllowedProjectIds(user, projectId);

  if (allowedProjectIds && allowedProjectIds.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const windowStart = new Date(to);
  windowStart.setDate(windowStart.getDate() - inactiveDays);

  const projectWhere = allowedProjectIds
    ? { id: { in: allowedProjectIds } }
    : undefined;

  const [projects, issueCreations, issueUpdates, standupEntries] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      select: { id: true, name: true },
    }),
    prisma.issue.groupBy({
      by: ["projectId"],
      where: {
        ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
        createdAt: { lte: to },
      },
      _max: { createdAt: true },
    }),
    prisma.issue.groupBy({
      by: ["projectId"],
      where: {
        ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
        updatedAt: { lte: to },
      },
      _max: { updatedAt: true },
    }),
    prisma.dailyStandupEntry.groupBy({
      by: ["projectId"],
      where: {
        ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
        createdAt: { lte: to },
      },
      _max: { createdAt: true },
    }),
  ]);

  const activityMap = new Map<string, ActivityRecord>();

  issueCreations.forEach((group) => {
    if (!group._max.createdAt) return;
    addActivityRecord(activityMap, {
      projectId: group.projectId,
      at: group._max.createdAt,
      type: "issue_created",
    });
  });

  issueUpdates.forEach((group) => {
    if (!group._max.updatedAt) return;
    addActivityRecord(activityMap, {
      projectId: group.projectId,
      at: group._max.updatedAt,
      type: "issue_updated",
    });
  });

  standupEntries.forEach((group) => {
    if (!group._max.createdAt) return;
    addActivityRecord(activityMap, {
      projectId: group.projectId,
      at: group._max.createdAt,
      type: "standup",
    });
  });

  const inactiveProjects = projects
    .map((project) => {
      const activity = activityMap.get(project.id);
      return {
        projectId: project.id,
        projectName: project.name,
        lastActivityAt: activity?.at ?? null,
        lastActivityType: activity?.type ?? null,
      };
    })
    .filter((project) => {
      if (!project.lastActivityAt) return true;
      return project.lastActivityAt < windowStart;
    })
    .sort((a, b) => {
      const aTime = a.lastActivityAt?.getTime() ?? 0;
      const bTime = b.lastActivityAt?.getTime() ?? 0;
      return aTime - bTime;
    });

  return NextResponse.json({ inactiveProjects, inactiveDays });
}
