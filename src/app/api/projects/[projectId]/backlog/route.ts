import { IssueType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

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

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const assigneeId = searchParams.get("assigneeId");
  const epicId = searchParams.get("epicId");

  const issues = await prisma.issue.findMany({
    where: {
      projectId: params.projectId,
      sprintId: null,
      ...(type && Object.values(IssueType).includes(type as IssueType)
        ? { type: type as IssueType }
        : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(epicId ? { epicId } : {}),
    },
    include: {
      epic: true,
      assignee: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(issues);
}
