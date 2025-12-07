import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";

import { getUserFromRequest } from "../../../lib/auth";
import prisma from "../../../lib/db";
import { requireRole } from "../../../lib/permissions";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const isAllowed = await requireRole(user, [UserRole.ADMIN]);

  if (!isAllowed) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isArchived: true,
      workspaceId: true,
    },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { key, name, description } = await request.json();

  if (!key || !name) {
    return NextResponse.json(
      { message: "Project key and name are required." },
      { status: 400 }
    );
  }

  let workspace = await prisma.workspace.findFirst();

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: "Default Workspace",
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      key,
      name,
      description,
      isArchived: false,
      workspaceId: workspace.id,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
