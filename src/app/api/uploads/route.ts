import { NextRequest, NextResponse } from "next/server";

import { Attachment } from "@prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll("files");
  const issueId = formData.get("issueId") as string | null;
  const researchItemId = formData.get("researchItemId") as string | null;
  const projectId = formData.get("projectId") as string | null;

  if (!files.length) {
    return NextResponse.json({ message: "No files provided" }, { status: 400 });
  }

  if (issueId) {
    const issue = await prisma.issue.findUnique({
      where: { id: issueId },
      select: { projectId: true },
    });

    if (!issue) {
      return NextResponse.json({ message: "Issue not found" }, { status: 404 });
    }

    if (!projectId) {
      formData.set("projectId", issue.projectId);
    }
  }

  if (researchItemId) {
    const item = await prisma.researchItem.findUnique({
      where: { id: researchItemId },
      select: { projectId: true },
    });

    if (!item) {
      return NextResponse.json({ message: "Research item not found" }, { status: 404 });
    }

    if (!projectId) {
      formData.set("projectId", item.projectId);
    }
  }

  const uploads = [] as Attachment[];

  for (const entry of files) {
    if (!(entry instanceof File)) continue;

    const saved = await saveUpload(entry);

    const attachment = await prisma.attachment.create({
      data: {
        projectId: (formData.get("projectId") as string) || null,
        issueId: issueId || null,
        researchItemId: researchItemId || null,
        uploadedById: user.id,
        fileName: saved.fileName,
        mimeType: entry.type || "application/octet-stream",
        size: saved.size,
        url: saved.publicUrl,
      },
    });

    uploads.push(attachment);
  }

  if (!uploads.length) {
    return NextResponse.json({ message: "No valid files provided" }, { status: 400 });
  }

  return NextResponse.json({ attachments: uploads }, { status: 201 });
}
