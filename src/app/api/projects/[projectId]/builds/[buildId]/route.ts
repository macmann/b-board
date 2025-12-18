import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { BuildEnvironment, BuildStatus } from "../../../../../../lib/prismaEnums";
import { getUserFromRequest } from "../../../../../../lib/auth";
import prisma from "../../../../../../lib/db";
import { jsonError } from "../../../../../../lib/apiResponse";
import { ensureProjectRole, ForbiddenError } from "../../../../../../lib/permissions";
import {
  PROJECT_ADMIN_ROLES,
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../../../lib/roles";
import { resolveProjectId, type ProjectParams } from "../../../../../../lib/params";
import { logError, logInfo } from "@/lib/logger";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";

const buildStatusEnum = z.enum([
  BuildStatus.PLANNED,
  BuildStatus.IN_PROGRESS,
  BuildStatus.DEPLOYED,
  BuildStatus.ROLLED_BACK,
  BuildStatus.CANCELLED,
]);

const buildEnvironmentEnum = z.enum([
  BuildEnvironment.DEV,
  BuildEnvironment.STAGING,
  BuildEnvironment.UAT,
  BuildEnvironment.PROD,
]);

const updateBuildSchema = z
  .object({
    key: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    status: buildStatusEnum.optional(),
    environment: buildEnvironmentEnum.optional(),
    plannedAt: z.string().datetime().nullable().optional(),
    deployedAt: z.string().datetime().nullable().optional(),
    issueIds: z.array(z.string().cuid()).optional(),
  })
  .strict();

const toDate = (value: string | null): Date | null => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapBuild = (build: {
  id: string;
  projectId: string;
  key: string;
  name: string | null;
  description: string | null;
  status: (typeof BuildStatus)[keyof typeof BuildStatus];
  environment: (typeof BuildEnvironment)[keyof typeof BuildEnvironment];
  plannedAt: Date | null;
  deployedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  issueLinks?: { issueId: string }[];
}) => ({
  id: build.id,
  projectId: build.projectId,
  key: build.key,
  name: build.name,
  description: build.description,
  status: build.status,
  environment: build.environment,
  plannedAt: build.plannedAt,
  deployedAt: build.deployedAt,
  createdById: build.createdById,
  createdAt: build.createdAt,
  updatedAt: build.updatedAt,
  issueIds: build.issueLinks?.map((link) => link.issueId) ?? [],
});

const findBuildForProject = async (projectId: string, buildId: string) => {
  return prisma.build.findFirst({
    where: { id: buildId, projectId },
    include: { issueLinks: { select: { issueId: true } } },
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams & { buildId: string } }
) {
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);
    const buildId = params.buildId;

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id);

      await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);

      const build = await findBuildForProject(projectId, buildId);

      if (!build) {
        return jsonError("Build not found", 404);
      }

      return NextResponse.json(mapBuild(build));
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return jsonError("Forbidden", 403);
      }

      logError("Failed to fetch build", { projectId, buildId, error });

      return jsonError("Internal server error", 500);
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: ProjectParams & { buildId: string } }
) {
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);
    const buildId = params.buildId;

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id);

      await ensureProjectRole(prisma, user.id, projectId, PROJECT_CONTRIBUTOR_ROLES);

      const build = await findBuildForProject(projectId, buildId);

      if (!build) {
        return jsonError("Build not found", 404);
      }

      const body = await request.json();
      const parsed = updateBuildSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { message: "Invalid payload", errors: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const {
        key,
        name,
        description,
        status,
        environment,
        plannedAt,
        deployedAt,
        issueIds,
      } = parsed.data;

      const plannedAtDate = plannedAt === undefined ? undefined : toDate(plannedAt);
      const deployedAtDate =
        deployedAt === undefined ? undefined : toDate(deployedAt);

      if (plannedAt !== undefined && plannedAtDate === null && plannedAt !== null) {
        return jsonError("Invalid plannedAt", 400);
      }

      if (
        deployedAt !== undefined &&
        deployedAtDate === null &&
        deployedAt !== null
      ) {
        return jsonError("Invalid deployedAt", 400);
      }

      const uniqueIssueIds =
        issueIds === undefined ? undefined : [...new Set(issueIds ?? [])];

      if (uniqueIssueIds && uniqueIssueIds.length) {
        const issues = await prisma.issue.findMany({
          where: { id: { in: uniqueIssueIds }, projectId },
          select: { id: true },
        });

        if (issues.length !== uniqueIssueIds.length) {
          return jsonError("One or more issues do not belong to the project", 400);
        }
      }

      const data: Parameters<typeof prisma.build.update>[0]["data"] = {
        ...(key ? { key } : {}),
        ...(name !== undefined ? { name: name ?? null } : {}),
        ...(description !== undefined
          ? { description: description ?? null }
          : {}),
        ...(status ? { status } : {}),
        ...(environment ? { environment } : {}),
        ...(plannedAt !== undefined ? { plannedAt: plannedAtDate ?? null } : {}),
        ...(deployedAt !== undefined ? { deployedAt: deployedAtDate ?? null } : {}),
      };

      try {
        const updatedBuild = await prisma.$transaction(async (tx) => {
          if (uniqueIssueIds) {
            await tx.buildIssue.deleteMany({ where: { buildId } });

            if (uniqueIssueIds.length) {
              await tx.buildIssue.createMany({
                data: uniqueIssueIds.map((issueId) => ({ buildId, issueId })),
              });
            }
          }

          return tx.build.update({
            where: { id: buildId },
            data,
            include: { issueLinks: { select: { issueId: true } } },
          });
        });

        logInfo("Build updated", {
          projectId,
          buildId,
          key: data.key ?? build.key,
          status: data.status ?? build.status,
          environment: data.environment ?? build.environment,
          issueCount: updatedBuild.issueLinks.length,
        });

        return NextResponse.json(mapBuild(updatedBuild));
      } catch (error: unknown) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          return jsonError("A build with this key already exists", 409);
        }

        throw error;
      }
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return jsonError("Forbidden", 403);
      }

      logError("Failed to update build", { projectId, buildId, error });

      return jsonError("Internal server error", 500);
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: ProjectParams & { buildId: string } }
) {
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);
    const buildId = params.buildId;

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    try {
      const user = await getUserFromRequest(request);

      if (!user) {
        return jsonError("Unauthorized", 401);
      }

      setRequestContextUser(user.id);

      await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);

      const build = await findBuildForProject(projectId, buildId);

      if (!build) {
        return jsonError("Build not found", 404);
      }

      if (build.status === BuildStatus.DEPLOYED) {
        return jsonError("Deployed builds cannot be deleted", 400);
      }

      await prisma.build.delete({ where: { id: buildId } });

      logInfo("Build deleted", { projectId, buildId, key: build.key });

      return NextResponse.json({}, { status: 204 });
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return jsonError("Forbidden", 403);
      }

      logError("Failed to delete build", { projectId, buildId, error });

      return jsonError("Internal server error", 500);
    }
  });
}
