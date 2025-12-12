import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { logError } from "../../../lib/logger";
import { ProjectRole } from "../../../lib/roles";
import { IssueStatus, SprintStatus } from "../../../lib/prismaEnums";

type IssueStatusValue = (typeof IssueStatus)[keyof typeof IssueStatus];

type IssueStatusCount = {
  projectId: string;
  status: IssueStatusValue;
  _count: { _all: number };
};

type ProjectSummary = {
  id: string;
  key: string;
  name: string;
  description?: string;
  role: ProjectRole;
  enableResearchBoard: boolean;
  standupEnabled: boolean;
  activeSprint: { id: string; name: string } | null;
  stats: {
    openIssues: number;
    inProgressIssues: number;
    blockedIssues: number;
  };
};

const buildIssueStats = (
  projectIds: string[],
  issueCounts: IssueStatusCount[]
): Record<string, ProjectSummary["stats"]> => {
  const initialStats = Object.fromEntries(
    projectIds.map((id) => [id, { openIssues: 0, inProgressIssues: 0, blockedIssues: 0 }])
  );

  issueCounts.forEach(({ projectId, status, _count }) => {
    const stats = initialStats[projectId];
    if (!stats) return;

    const count = _count?._all ?? 0;

    if (status !== IssueStatus.DONE) {
      stats.openIssues += count;
    }

    if (status === IssueStatus.IN_PROGRESS) {
      stats.inProgressIssues += count;
    }

    if (status === IssueStatus.IN_REVIEW) {
      stats.blockedIssues += count;
    }
  });

  return initialStats;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const memberships = await prisma.projectMember.findMany({
      where: { userId: user.id },
      include: {
        project: {
          select: {
            id: true,
            key: true,
            name: true,
            description: true,
            enableResearchBoard: true,
            settings: {
              select: {
                standupWindowStart: true,
                standupWindowEnd: true,
              },
            },
            sprints: {
              where: { status: SprintStatus.ACTIVE },
              select: { id: true, name: true, status: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const projectIds = memberships.map((membership) => membership.project.id);

    const issueCounts = projectIds.length
      ? await prisma.issue.groupBy({
          by: ["projectId", "status"],
          where: { projectId: { in: projectIds } },
          _count: { _all: true },
        })
      : [];

    const normalizedIssueCounts: IssueStatusCount[] = issueCounts.map((count) => ({
      projectId: count.projectId,
      status: count.status as IssueStatusValue,
      _count: { _all: typeof count._count === "number" ? count._count : count._count?._all ?? 0 },
    }));

    const statsByProjectId = buildIssueStats(projectIds, normalizedIssueCounts);

    const projects: ProjectSummary[] = memberships.map((membership) => {
      const project = membership.project;
      const activeSprint = project.sprints?.[0] ?? null;
      const standupEnabled = Boolean(
        project.settings?.standupWindowStart && project.settings?.standupWindowEnd
      );

      return {
        id: project.id,
        key: project.key,
        name: project.name,
        description: project.description ?? undefined,
        role: membership.role as ProjectRole,
        enableResearchBoard: project.enableResearchBoard,
        standupEnabled,
        activeSprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null,
        stats: statsByProjectId[project.id] ?? {
          openIssues: 0,
          inProgressIssues: 0,
          blockedIssues: 0,
        },
      };
    });

    return NextResponse.json(projects);
  } catch (error) {
    logError("Failed to fetch user projects", error);

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
