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
import { Role, AuditActorType, AuditEntityType } from "../../../../lib/prismaEnums";
import { safeLogAudit } from "../../../../lib/auditLogger";
import { setRequestContextUser, withRequestContext } from "../../../../lib/requestContext";

export async function GET(
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
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
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
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);

    if (!projectId) {
      return NextResponse.json({ message: "projectId is required" }, { status: 400 });
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    setRequestContextUser(user.id, [user.role]);

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

    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, key: true, description: true, enableResearchBoard: true },
    });

    if (!existingProject) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, key, description, enableResearchBoard } = body ?? {};

    if (!name || !key) {
      return NextResponse.json(
        { message: "name and key are required" },
        { status: 400 }
      );
    }

    if (
      typeof enableResearchBoard !== "undefined" &&
      typeof enableResearchBoard !== "boolean"
    ) {
      return NextResponse.json(
        { message: "enableResearchBoard must be a boolean" },
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
          ...(typeof enableResearchBoard === "boolean"
            ? { enableResearchBoard }
            : {}),
        },
      });

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const trackChange = (field: string, beforeValue: unknown, afterValue: unknown) => {
        if (beforeValue === afterValue) return;
        before[field] = beforeValue ?? null;
        after[field] = afterValue ?? null;
      };

      trackChange("name", existingProject.name, updated.name);
      trackChange("key", existingProject.key, updated.key);
      trackChange("description", existingProject.description, updated.description);
      trackChange(
        "enableResearchBoard",
        existingProject.enableResearchBoard,
        updated.enableResearchBoard
      );

      const changedFields = Object.keys(after);

      if (changedFields.length > 0) {
        try {
          await safeLogAudit({
            projectId,
            actorType: AuditActorType.USER,
            actorId: user.id,
            action: "PROJECT_UPDATED",
            entityType: AuditEntityType.PROJECT,
            entityId: projectId,
            summary: `Updated ${changedFields.join(", ")}`,
            before,
            after,
          });
        } catch (auditError) {
          logError("Failed to record audit log for project update", auditError);
        }
      }

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
  });
}
