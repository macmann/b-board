import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";
import { IssueStatus } from "@/lib/prismaEnums";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const { sprintId } = await params;

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, projectId: true },
    });

    if (!sprint) {
      return jsonError("Sprint not found", 404);
    }

    await ensureProjectRole(prisma, user.id, sprint.projectId, PROJECT_VIEWER_ROLES);

    const [statusCounts, builds] = await Promise.all([
      prisma.issue.groupBy({
        by: ["status"],
        where: { sprintId, projectId: sprint.projectId },
        _count: { _all: true },
      }),
      prisma.build.findMany({
        where: {
          projectId: sprint.projectId,
          issueLinks: { some: { issue: { sprintId } } },
        },
        select: {
          id: true,
          key: true,
          status: true,
          environment: true,
          deployedAt: true,
          _count: { select: { issueLinks: true } },
        },
        orderBy: [
          { deployedAt: "desc" },
          { plannedAt: "desc" },
          { createdAt: "desc" },
        ],
      }),
    ]);

    const countsByStatus = new Map<
      (typeof IssueStatus)[keyof typeof IssueStatus],
      number
    >(
      statusCounts.map((group) => [
        group.status as (typeof IssueStatus)[keyof typeof IssueStatus],
        typeof group._count === "number" ? group._count : group._count._all ?? 0,
      ])
    );

    const totalIssues = statusCounts.reduce((sum, group) => {
      const value = typeof group._count === "number" ? group._count : group._count._all ?? 0;
      return sum + value;
    }, 0);

    const doneIssues = countsByStatus.get(IssueStatus.DONE) ?? 0;
    const blockingIssues = countsByStatus.get(IssueStatus.IN_REVIEW) ?? 0;

    const potentiallyReleasable = doneIssues > 0 && blockingIssues === 0;

    return NextResponse.json({
      sprintId,
      totalIssues,
      doneIssues,
      blockingIssues,
      potentiallyReleasable,
      builds: builds.map((build) => ({
        id: build.id,
        key: build.key,
        status: build.status,
        environment: build.environment,
        deployedAt: build.deployedAt?.toISOString() ?? null,
        issueCount: build._count.issueLinks,
      })),
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError(error.message, 403);
    }

    return jsonError("Internal server error", 500);
  }
}
