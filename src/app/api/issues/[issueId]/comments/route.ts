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
    include: { author: true, attachments: true },
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
  const { body: commentBody, attachmentIds } = body;

  if (!commentBody || typeof commentBody !== "string") {
    return NextResponse.json({ message: "Comment body is required" }, { status: 400 });
  }

  const validAttachmentIds = Array.isArray(attachmentIds)
    ? (attachmentIds as string[]).filter(Boolean)
    : [];

  const comment = await prisma.comment.create({
    data: {
      issueId,
      authorId: user.id,
      body: commentBody,
    },
    include: { author: true, attachments: true },
  });

  if (validAttachmentIds.length > 0) {
    await prisma.attachment.updateMany({
      where: { id: { in: validAttachmentIds }, issueId, commentId: null },
      data: { commentId: comment.id },
    });
  }

  const commentWithAttachments = await prisma.comment.findUnique({
    where: { id: comment.id },
    include: { author: true, attachments: true },
  });

  return NextResponse.json(commentWithAttachments, { status: 201 });
}
