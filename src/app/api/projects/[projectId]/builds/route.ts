import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { BuildEnvironment, BuildStatus } from "../../../../../lib/prismaEnums";
import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/apiResponse";
import { ensureProjectRole, ForbiddenError } from "../../../../../lib/permissions";
import {
  PROJECT_CONTRIBUTOR_ROLES,
  PROJECT_VIEWER_ROLES,
} from "../../../../../lib/roles";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";

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

const createBuildSchema = z.object({
  key: z.string().trim().min(1, "Key is required"),
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  status: buildStatusEnum.optional(),
  environment: buildEnvironmentEnum.optional(),
  plannedAt: z.string().datetime().optional().nullable(),
  deployedAt: z.string().datetime().optional().nullable(),
  issueIds: z.array(z.string().cuid()).optional(),
});

const updateBuildSchema = createBuildSchema.partial();

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

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const environmentParam = searchParams.get("environment");
    const search = searchParams.get("search");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Parameters<typeof prisma.build.findMany>[0]["where"] = {
      projectId,
    };

    if (statusParam) {
      const parsedStatus = buildStatusEnum.safeParse(statusParam);

      if (!parsedStatus.success) {
        return jsonError("Invalid status filter", 400);
      }

      where.status = parsedStatus.data;
    }

    if (environmentParam) {
      const parsedEnvironment = buildEnvironmentEnum.safeParse(environmentParam);

      if (!parsedEnvironment.success) {
        return jsonError("Invalid environment filter", 400);
      }

      where.environment = parsedEnvironment.data;
    }

    if (search) {
      where.OR = [
        { key: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const fromDate = toDate(from);
    const toDateValue = toDate(to);

    if (from && !fromDate) {
      return jsonError("Invalid from date", 400);
    }

    if (to && !toDateValue) {
      return jsonError("Invalid to date", 400);
    }

    const dateFilters: { plannedAt?: {}; deployedAt?: {} }[] = [];

    if (fromDate) {
      dateFilters.push({ plannedAt: { gte: fromDate } });
      dateFilters.push({ deployedAt: { gte: fromDate } });
    }

    if (toDateValue) {
      dateFilters.push({ plannedAt: { lte: toDateValue } });
      dateFilters.push({ deployedAt: { lte: toDateValue } });
    }

    if (dateFilters.length) {
      where.AND = [...(where.AND ?? []), { OR: dateFilters }];
    }

    const builds = await prisma.build.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { issueLinks: { select: { issueId: true } } },
    });

    return NextResponse.json(builds.map(mapBuild));
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    return jsonError("Internal server error", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    await ensureProjectRole(prisma, user.id, projectId, PROJECT_CONTRIBUTOR_ROLES);

    const body = await request.json();
    const parsed = createBuildSchema.safeParse(body);

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

    const plannedAtDate = toDate(plannedAt ?? null);
    const deployedAtDate = toDate(deployedAt ?? null);

    if (plannedAt && !plannedAtDate) {
      return jsonError("Invalid plannedAt", 400);
    }

    if (deployedAt && !deployedAtDate) {
      return jsonError("Invalid deployedAt", 400);
    }

    const uniqueIssueIds = [...new Set(issueIds ?? [])];

    if (uniqueIssueIds.length) {
      const issues = await prisma.issue.findMany({
        where: { id: { in: uniqueIssueIds }, projectId },
        select: { id: true },
      });

      if (issues.length !== uniqueIssueIds.length) {
        return jsonError("One or more issues do not belong to the project", 400);
      }
    }

    try {
      const build = await prisma.build.create({
        data: {
          projectId,
          key,
          name: name ?? null,
          description: description ?? null,
          status: status ?? BuildStatus.PLANNED,
          environment: environment ?? BuildEnvironment.DEV,
          plannedAt: plannedAtDate,
          deployedAt: deployedAtDate,
          createdById: user.id,
          issueLinks:
            uniqueIssueIds.length === 0
              ? undefined
              : {
                  create: uniqueIssueIds.map((issueId) => ({
                    issue: { connect: { id: issueId } },
                  })),
                },
        },
        include: { issueLinks: { select: { issueId: true } } },
      });

      return NextResponse.json(mapBuild(build), { status: 201 });
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

    return jsonError("Internal server error", 500);
  }
}
