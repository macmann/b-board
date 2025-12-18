import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getUserFromRequest } from "../../../../../lib/auth";
import { jsonError } from "../../../../../lib/apiResponse";
import prisma from "../../../../../lib/db";
import {
  IssueProjectMismatchError,
  validateIssueIdsForProject,
} from "../../../../../lib/buildIssues";
import { ensureProjectRole, ForbiddenError } from "../../../../../lib/permissions";
import { PROJECT_CONTRIBUTOR_ROLES } from "../../../../../lib/roles";
import { logError, logInfo } from "@/lib/logger";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";

const issueListSchema = z.object({
  issueIds: z.array(z.string().cuid()).min(1, "issueIds is required"),
});

const mapBuildIssues = (build: {
  id: string;
  projectId: string;
  issueLinks: { issueId: string }[];
}) => ({
  id: build.id,
  projectId: build.projectId,
  issueIds: build.issueLinks.map((link) => link.issueId),
});

const getBuildForAccess = async (buildId: string) => {
  return prisma.build.findUnique({
    where: { id: buildId },
    select: { id: true, projectId: true },
  });
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ buildId: string }> }
) {
  return withRequestContext(request, async () => {
    const { buildId } = await context.params;

    if (!buildId) {
      return jsonError("buildId is required", 400);
    }

    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id);

      const build = await getBuildForAccess(buildId);

      if (!build) {
        return jsonError("Build not found", 404);
      }

      await ensureProjectRole(
        prisma,
        user.id,
        build.projectId,
        PROJECT_CONTRIBUTOR_ROLES
      );

      const body = await request.json();
      const parsed = issueListSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { message: "Invalid payload", errors: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const issueIds = await validateIssueIdsForProject(
        prisma,
        build.projectId,
        parsed.data.issueIds
      );

      const updated = await prisma.$transaction(async (tx) => {
        await tx.buildIssue.createMany({
          data: issueIds.map((issueId) => ({ buildId: build.id, issueId })),
          skipDuplicates: true,
        });

        return tx.build.findUnique({
          where: { id: build.id },
          select: {
            id: true,
            projectId: true,
            issueLinks: { select: { issueId: true } },
          },
        });
      });

      logInfo("Issues linked to build", {
        buildId: build.id,
        projectId: build.projectId,
        issueCount: issueIds.length,
      });

      return NextResponse.json(mapBuildIssues(updated!));
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return jsonError("Forbidden", 403);
      }

      if (error instanceof IssueProjectMismatchError) {
        return jsonError(error.message, 400);
      }

      logError("Failed to link issues to build", { buildId, error });

      return jsonError("Internal server error", 500);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ buildId: string }> }
) {
  return withRequestContext(request, async () => {
    const { buildId } = await context.params;

    if (!buildId) {
      return jsonError("buildId is required", 400);
    }

    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id);

      const build = await getBuildForAccess(buildId);

      if (!build) {
        return jsonError("Build not found", 404);
      }

      await ensureProjectRole(
        prisma,
        user.id,
        build.projectId,
        PROJECT_CONTRIBUTOR_ROLES
      );

      const body = await request.json();
      const parsed = issueListSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { message: "Invalid payload", errors: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const issueIds = await validateIssueIdsForProject(
        prisma,
        build.projectId,
        parsed.data.issueIds
      );

      const updated = await prisma.$transaction(async (tx) => {
        await tx.buildIssue.deleteMany({
          where: { buildId: build.id, issueId: { in: issueIds } },
        });

        return tx.build.findUnique({
          where: { id: build.id },
          select: {
            id: true,
            projectId: true,
            issueLinks: { select: { issueId: true } },
          },
        });
      });

      logInfo("Issues unlinked from build", {
        buildId: build.id,
        projectId: build.projectId,
        issueCount: issueIds.length,
      });

      return NextResponse.json(mapBuildIssues(updated!));
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return jsonError("Forbidden", 403);
      }

      if (error instanceof IssueProjectMismatchError) {
        return jsonError(error.message, 400);
      }

      logError("Failed to unlink issues from build", { buildId, error });

      return jsonError("Internal server error", 500);
    }
  });
}
