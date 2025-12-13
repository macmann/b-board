import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { deleteUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  const { attachmentId } = await params;
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });

  if (!attachment) {
    return NextResponse.json({ message: "Attachment not found" }, { status: 404 });
  }

  if (attachment.uploadedById !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const filePath = path.join(process.cwd(), "public", attachment.url.replace(/^\//, ""));

  await prisma.attachment.delete({ where: { id: attachmentId } });
  await deleteUpload(filePath);

  return NextResponse.json({ message: "Attachment deleted" });
}
