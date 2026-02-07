import { NextRequest } from "next/server";

import { EpicStatus, IssueType, Role } from "@/lib/prismaEnums";
import { jsonError, jsonOk } from "@/lib/apiResponse";
import prisma from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  AuthorizationError,
  requireProjectRole,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await requireProjectRole(user.id, projectId, [
      Role.ADMIN,
      Role.PO,
      Role.DEV,
      Role.QA,
      Role.VIEWER,
    ]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  const epics = await prisma.epic.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      issues: {
        where: { type: IssueType.STORY },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          type: true,
        },
      },
    },
  });

  return jsonOk({ epics });
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  try {
    await requireProjectRole(user.id, projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const status = Object.values(EpicStatus).includes(body.status as EpicStatus)
    ? (body.status as EpicStatus)
    : EpicStatus.TODO;

  if (!title) {
    return jsonError("Title is required", 400);
  }

  const epic = await prisma.epic.create({
    data: {
      projectId,
      title,
      description: description || null,
      status,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
    },
  });

  return jsonOk({ epic }, { status: 201 });
}
