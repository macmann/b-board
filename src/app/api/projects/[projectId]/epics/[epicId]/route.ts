import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/apiResponse";
import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { AuthorizationError, requireProjectRole } from "@/lib/permissions";
import { resolveProjectId } from "@/lib/params";
import { Role } from "@/lib/prismaEnums";

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
