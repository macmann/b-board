import { UserRole } from "@prisma/client";
import { NextRequest } from "next/server";

import { getUserFromRequest } from "../../../lib/auth";
import { jsonError, jsonOk } from "../../../lib/apiResponse";
import prisma from "../../../lib/db";
import { logError } from "../../../lib/logger";
import { requireRole } from "../../../lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const isAllowed = await requireRole(user, [UserRole.ADMIN]);

    if (!isAllowed) {
      return jsonError("Forbidden", 403);
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

    return jsonOk(projects);
  } catch (error) {
    logError("Failed to fetch projects", error);
    return jsonError("Something went wrong", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { key, name, description } = await request.json();

    if (!key || !name) {
      return jsonError("Project key and name are required.", 400);
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
    return jsonError("Something went wrong", 500);
  }
}
