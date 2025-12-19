import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { IssueStatus, Role } from "@/lib/prismaEnums";

const parseDateOnly = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseThreshold = (value: string | null, fallback: number) => {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
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

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateOnly(searchParams.get("from"));
  const to = parseDateOnly(searchParams.get("to"));
  const thresholdDays = parseThreshold(searchParams.get("thresholdDays"), 14);
  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== "all" ? projectParam : null;

  if (!from || !to || to < from) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  const allowedProjectIds = await getAllowedProjectIds(user, projectId);

  if (allowedProjectIds && allowedProjectIds.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const openIssues = await prisma.issue.findMany({
    where: {
      status: { not: IssueStatus.DONE },
      createdAt: { gte: from, lte: to },
      ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
    },
    select: {
      key: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      assignee: { select: { name: true } },
      project: { select: { name: true } },
    },
  });

  const now = new Date();
  const staleIssues = openIssues
    .map((issue) => {
      const ageDays = Math.floor(
        (now.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysSinceUpdate = Math.floor(
        (now.getTime() - issue.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        key: issue.key ?? "Unkeyed",
        title: issue.title,
        status: issue.status,
        assignee: issue.assignee?.name ?? null,
        ageDays,
        project: issue.project.name,
        daysSinceUpdate,
      };
    })
    .filter((issue) => issue.ageDays >= thresholdDays)
    .sort((a, b) => b.ageDays - a.ageDays);

  return NextResponse.json({
    staleCount: staleIssues.length,
    staleIssues,
  });
}
