import path from "path";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { logError } from "@/lib/logger";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  AuthorizationError,
  ForbiddenError,
  requireProjectRole,
} from "@/lib/permissions";
import { Role } from "@/lib/prismaEnums";
import { deleteUpload, saveUpload } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_ICON_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const getFilePathFromUrl = (url: string) =>
  path.join(process.cwd(), "public", url.replace(/^\//, ""));

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireProjectRole(user.id, projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    logError("Failed to authorize project icon upload", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { iconUrl: true },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const icon = formData.get("icon");

  if (!(icon instanceof File)) {
    return NextResponse.json({ message: "Icon file is required" }, { status: 400 });
  }

  if (!icon.type?.startsWith("image/")) {
    return NextResponse.json({ message: "Only image files are supported" }, { status: 400 });
  }

  if (icon.size > MAX_ICON_SIZE_BYTES) {
    return NextResponse.json(
      { message: "Please upload an image smaller than 2MB" },
      { status: 400 }
    );
  }

  try {
    const saved = await saveUpload(icon);

    if (project.iconUrl) {
      await deleteUpload(getFilePathFromUrl(project.iconUrl));
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { iconUrl: saved.publicUrl },
      select: { iconUrl: true },
    });

    return NextResponse.json({ iconUrl: updated.iconUrl }, { status: 201 });
  } catch (error) {
    logError("Failed to upload project icon", error);
    return NextResponse.json(
      { message: "Unable to upload project icon" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireProjectRole(user.id, projectId, [Role.ADMIN, Role.PO]);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    logError("Failed to authorize project icon removal", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { iconUrl: true },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  try {
    if (project.iconUrl) {
      await deleteUpload(getFilePathFromUrl(project.iconUrl));
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { iconUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Failed to remove project icon", error);
    return NextResponse.json(
      { message: "Unable to remove project icon" },
      { status: 500 }
    );
  }
}
