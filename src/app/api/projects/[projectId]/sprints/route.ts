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

  const sprints = await prisma.sprint.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(sprints);
}

export async function POST(
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

  const body = await request.json();
  const { name, goal, startDate, endDate } = body;

  if (!name) {
    return NextResponse.json({ message: "Name is required" }, { status: 400 });
  }

  const parseDate = (value: string | null | undefined) => {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const parsedStartDate = parseDate(startDate);
  const parsedEndDate = parseDate(endDate);

  if (startDate && !parsedStartDate) {
    return NextResponse.json({ message: "Invalid start date" }, { status: 400 });
  }

  if (endDate && !parsedEndDate) {
    return NextResponse.json({ message: "Invalid end date" }, { status: 400 });
  }

  const sprint = await prisma.sprint.create({
    data: {
      projectId: params.projectId,
      name,
      goal: goal ?? null,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: SprintStatus.PLANNED,
    },
  });

  return NextResponse.json(sprint, { status: 201 });
}
