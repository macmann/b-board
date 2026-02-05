import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";

type SavedFile = {
  fileName: string;
  filePath: string;
  publicUrl: string;
  size: number;
};

const DEFAULT_UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export function getUploadsDir() {
  return process.env.UPLOADS_DIR || DEFAULT_UPLOAD_DIR;
}

export function getUploadPathFromUrl(publicUrl: string) {
  const uploadsDir = getUploadsDir();
  const relativePath = publicUrl.replace(/^\/uploads\//, "");
  return path.join(uploadsDir, relativePath);
}

export async function ensureUploadDir() {
  const uploadDir = getUploadsDir();
  await fs.mkdir(uploadDir, { recursive: true });
  return uploadDir;
}

export async function saveUpload(file: File): Promise<SavedFile> {
  const uploadDir = await ensureUploadDir();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_/ ]/g, "").replace(/\s+/g, "-");
  const uniqueName = `${randomUUID()}-${cleanName || "upload"}`;
  const filePath = path.join(uploadDir, uniqueName);

  await fs.writeFile(filePath, buffer);

  return {
    fileName: file.name || "upload",
    filePath,
    publicUrl: `/uploads/${uniqueName}`,
    size: buffer.length,
  };
}

export async function deleteUpload(filePath: string) {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    // ignore missing files
  }
}
