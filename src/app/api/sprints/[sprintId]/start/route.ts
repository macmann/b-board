import { NextRequest, NextResponse } from "next/server";
import { SprintStatus } from "@prisma/client";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { sprintId: string } }
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sprint = await prisma.sprint.findUnique({
    where: { id: params.sprintId },
  });

  if (!sprint) {
    return NextResponse.json({ message: "Sprint not found" }, { status: 404 });
  }

  if (sprint.status !== SprintStatus.PLANNED) {
    return NextResponse.json(
      { message: "Only planned sprints can be started" },
      { status: 400 }
    );
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: {
      projectId: sprint.projectId,
      status: SprintStatus.ACTIVE,
      NOT: { id: sprint.id },
    },
  });

  if (activeSprint) {
    return NextResponse.json(
      { message: "Another active sprint already exists for this project" },
      { status: 400 }
    );
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
