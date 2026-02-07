import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";
import { resolveProjectId } from "@/lib/params";
import { EpicStatus, Role } from "@/lib/prismaEnums";

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string; epicId: string }> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);
  const { epicId } = params;

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  if (!epicId) {
    return jsonError("epicId is required", 400);
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

  const epic = await prisma.epic.findFirst({
    where: { id: epicId, projectId },
    select: { id: true },
  });

  if (!epic) {
    return jsonError("Epic not found", 404);
  }

  await prisma.epic.delete({ where: { id: epic.id } });

  return jsonOk({ epicId: epic.id });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string; epicId: string }> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);
  const { epicId } = params;

  if (!projectId) {
    return jsonError("projectId is required", 400);
  }

  if (!epicId) {
    return jsonError("epicId is required", 400);
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

  const epic = await prisma.epic.findFirst({
    where: { id: epicId, projectId },
    select: { id: true },
  });

  if (!epic) {
    return jsonError("Epic not found", 404);
  }

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : null;
  const status = Object.values(EpicStatus).includes(body.status as EpicStatus)
    ? (body.status as EpicStatus)
    : undefined;

  if (!title) {
    return jsonError("Title is required", 400);
  }

  const updatedEpic = await prisma.epic.update({
    where: { id: epic.id },
    data: {
      title,
      description: description || null,
      status: status ?? undefined,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
    },
  });

  return jsonOk({ epic: updatedEpic });
}
