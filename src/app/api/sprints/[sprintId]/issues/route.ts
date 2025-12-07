import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

export async function GET(
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

  const issues = await prisma.issue.findMany({
    where: { sprintId: params.sprintId },
    include: {
      assignee: true,
      epic: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(issues);
}
