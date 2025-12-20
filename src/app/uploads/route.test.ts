import fs from "fs/promises";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { deleteUpload, saveUpload } from "@/lib/storage";

describe("uploads route", () => {
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  afterEach(async () => {
    await fs.rm(uploadsDir, { recursive: true, force: true });
  });

  it("returns uploaded file content with correct headers", async () => {
    const content = "hello uploads";
    const file = new File([content], "hello.txt", { type: "text/plain" });
    const saved = await saveUpload(file);

    const { GET } = await import("./[...path]/route");
    const response = await GET(new NextRequest(`http://localhost${saved.publicUrl}`), {
      params: Promise.resolve({ path: saved.publicUrl.replace(/^\/uploads\//, "").split("/") }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    const body = Buffer.from(await response.arrayBuffer()).toString("utf-8");
    expect(body).toBe(content);

    await deleteUpload(saved.filePath);
  });

  it("blocks attempts to traverse outside uploads directory", async () => {
    const { GET } = await import("./[...path]/route");
    const response = await GET(new NextRequest("http://localhost/uploads/../../etc/passwd"), {
      params: Promise.resolve({ path: ["..", "..", "etc", "passwd"] }),
    });

    expect(response.status).toBe(404);
  });
});
