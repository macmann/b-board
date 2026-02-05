import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { deleteUpload, getUploadPathFromUrl, saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file provided." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "Only image files are supported." }, { status: 400 });
  }

  const saved = await saveUpload(file);

  if (user.avatarUrl?.startsWith("/uploads/")) {
    await deleteUpload(getUploadPathFromUrl(user.avatarUrl));
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl: saved.publicUrl },
    select: { avatarUrl: true },
  });

  return NextResponse.json({ avatarUrl: updated.avatarUrl });
}
