import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { lookup as lookupMimeType } from "mime-types";

import { getUploadsDir } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathParts } = await context.params;
  const uploadsDir = path.resolve(getUploadsDir());
  const relativePath = (pathParts ?? []).join("/");

  if (!relativePath) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  const filePath = path.resolve(uploadsDir, relativePath);

  if (!filePath.startsWith(uploadsDir)) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

  try {
    const data = await fs.readFile(filePath);
    const contentType = lookupMimeType(filePath) || "application/octet-stream";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Unable to read file" }, { status: 500 });
  }
}
