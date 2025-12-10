import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../lib/auth";
import prisma from "../../../../lib/db";
import { resolveProjectId, type ProjectParams } from "../../../../lib/params";
import {
  AuthorizationError,
  ForbiddenError,
  requireProjectRole,
} from "../../../../lib/permissions";
import { logError } from "../../../../lib/logger";
import { Role } from "../../../../lib/prismaEnums";

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return NextResponse.json({ message: "projectId is required" }, { status: 400 });
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  const projectId = await resolveProjectId(params);

  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!projectId) {
      return NextResponse.json(
        { message: "projectId is required" },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found" },
        { status: 404 }
      );
    }

    await requireProjectRole(user.id, projectId, [Role.ADMIN, Role.PO]);

    await prisma.project.delete({ where: { id: projectId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Failed to delete project", error);

    if (error instanceof ForbiddenError || error instanceof AuthorizationError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
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

    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, key, description } = body ?? {};

  if (!name || !key) {
    return NextResponse.json(
      { message: "name and key are required" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: {
        name,
        key,
        description,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logError("Failed to update project", error);

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
