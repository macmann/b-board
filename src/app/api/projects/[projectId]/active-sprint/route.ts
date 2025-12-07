import { NextRequest, NextResponse } from "next/server";
import { SprintStatus } from "@prisma/client";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId: params.projectId, status: SprintStatus.ACTIVE },
    orderBy: { startDate: "desc" },
  });

  return NextResponse.json(activeSprint);
}
