import { NextRequest, NextResponse } from "next/server";
import { Role, SprintStatus } from "../../../../../lib/prismaEnums";

import { getUserFromRequest } from "../../../../../lib/auth";
import {
  AuthorizationError,
  requireProjectRole,
} from "../../../../../lib/permissions";
import prisma from "../../../../../lib/db";
import { jsonError } from "../../../../../lib/apiResponse";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> }
) {
  const { sprintId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
  });

  if (!sprint) {
    return jsonError("Sprint not found", 404);
  }

  try {
    await requireProjectRole(user.id, sprint.projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return jsonError(error.message, error.status);
    }

    throw error;
  }

  if (sprint.status !== SprintStatus.PLANNED) {
    return jsonError("Only planned sprints can be started", 400);
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: {
      projectId: sprint.projectId,
      status: SprintStatus.ACTIVE,
      NOT: { id: sprint.id },
    },
  });

  if (activeSprint) {
    return jsonError("Another active sprint already exists for this project", 400);
  }

  const updatedSprint = await prisma.sprint.update({
    where: { id: sprint.id },
    data: {
      status: SprintStatus.ACTIVE,
      startDate: sprint.startDate ?? new Date(),
    },
  });

  return NextResponse.json(updatedSprint);
}
