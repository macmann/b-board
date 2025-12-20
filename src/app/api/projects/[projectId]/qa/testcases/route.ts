import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ensureProjectRole,
  ForbiddenError,
} from "@/lib/permissions";
import {
  Role,
  TestCasePriority,
  TestCaseStatus,
  TestCaseType,
} from "@/lib/prismaEnums";

const VIEW_ROLES = [Role.ADMIN, Role.PO, Role.DEV, Role.QA];
const EDIT_ROLES = [Role.ADMIN, Role.PO, Role.QA];

const isValidEnumValue = <T extends string>(value: unknown, values: T[]): value is T => {
  return typeof value === "string" && values.includes(value as T);
};

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, VIEW_ROLES);

    const searchParams = request.nextUrl.searchParams;
    const storyIssueId = searchParams.get("storyIssueId") ?? undefined;
    const q = searchParams.get("q") ?? undefined;
    const statusParam = searchParams.get("status") ?? undefined;

    const status = isValidEnumValue(statusParam, Object.values(TestCaseStatus))
      ? statusParam
      : undefined;

    const testCases = await prisma.testCase.findMany({
      where: {
        projectId,
        ...(storyIssueId ? { storyIssueId } : {}),
        ...(q
          ? {
              title: {
                contains: q,
                mode: "insensitive",
              },
            }
          : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: testCases });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][TestCases][GET]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const requestId = request.headers.get("x-request-id");
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, EDIT_ROLES);

    const body = await request.json();

    const {
      title,
      type,
      scenario,
      testData,
      expectedResult,
      priority,
      status,
      storyIssueId,
    } = body ?? {};

    if (!title || typeof title !== "string") {
      return jsonError("title is required", 400);
    }

    if (!isValidEnumValue(type, Object.values(TestCaseType))) {
      return jsonError("type is required", 400);
    }

    if (storyIssueId) {
      const storyIssue = await prisma.issue.findUnique({
        where: { id: storyIssueId },
        select: { projectId: true },
      });

      if (!storyIssue || storyIssue.projectId !== projectId) {
        return jsonError("Invalid storyIssueId", 400);
      }
    }

    const resolvedPriority = isValidEnumValue(
      priority,
      Object.values(TestCasePriority)
    )
      ? priority
      : TestCasePriority.MEDIUM;

    const resolvedStatus = isValidEnumValue(status, Object.values(TestCaseStatus))
      ? status
      : TestCaseStatus.DRAFT;

    const testCase = await prisma.testCase.create({
      data: {
        projectId,
        title,
        type,
        scenario: scenario ?? null,
        testData: testData ?? null,
        expectedResult: expectedResult ?? null,
        priority: resolvedPriority,
        status: resolvedStatus,
        storyIssueId: storyIssueId ?? null,
        createdById: user.id,
      },
    });

    return NextResponse.json({ ok: true, data: testCase }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return jsonError("Forbidden", 403);
    }

    console.error("[QA][TestCases][POST]", requestId ?? "n/a", error);
    return jsonError("Internal server error", 500);
  }
}
