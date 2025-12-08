import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../lib/auth";
import { jsonOk } from "../../../lib/apiResponse";
import prisma from "../../../lib/db";
import { logError } from "../../../lib/logger";
import { ensureGlobalRole, ForbiddenError } from "../../../lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    ensureGlobalRole(user, ["ADMIN"]);

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

    return jsonOk(projects);
  } catch (error) {
    logError("Failed to fetch projects", error);

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    ensureGlobalRole(user, ["ADMIN"]);

    const { key, name, description } = await request.json();

    if (!key || !name) {
      return NextResponse.json(
        { error: "Project key and name are required." },
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

    return jsonOk(project, { status: 201 });
  } catch (error) {
    logError("Failed to create project", error);

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
