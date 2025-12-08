import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import prisma from "../../../../../lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    return NextResponse.json({ message: "Issue not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { issueId },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
  });

  if (!issue) {
    return NextResponse.json({ message: "Issue not found" }, { status: 404 });
  }

  const body = await request.json();
  const { body: commentBody } = body;

  if (!commentBody || typeof commentBody !== "string") {
    return NextResponse.json({ message: "Comment body is required" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      issueId,
      authorId: user.id,
      body: commentBody,
    },
    include: { author: true },
  });

  return NextResponse.json(comment, { status: 201 });
}
