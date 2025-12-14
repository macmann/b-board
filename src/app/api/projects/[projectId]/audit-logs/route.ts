import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "../../../../../lib/auth";
import { jsonError } from "../../../../../lib/apiResponse";
import prisma from "../../../../../lib/db";
import { resolveProjectId, type ProjectParams } from "../../../../../lib/params";
import {
  AuditActorType,
  AuditEntityType,
  Role,
  UserRole,
} from "../../../../../lib/prismaEnums";
import { setRequestContextUser, withRequestContext } from "../../../../../lib/requestContext";

const parsePagination = (request: NextRequest) => {
  const searchParams = new URL(request.url).searchParams;
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 20));
  return { page, pageSize, searchParams };
};

export async function GET(
  request: NextRequest,
  { params }: { params: ProjectParams }
) {
  return withRequestContext(request, async () => {
    const projectId = await resolveProjectId(params);

    if (!projectId) {
      return jsonError("projectId is required", 400);
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    setRequestContextUser(user.id, [user.role]);

    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { role: true },
    });

    const isAdmin =
      user.role === UserRole.ADMIN ||
      membership?.role === Role.ADMIN ||
      membership?.role === Role.PO;

    if (!isAdmin) {
      return jsonError("Forbidden", 403);
    }

    const { page, pageSize, searchParams } = parsePagination(request);

    const entityType = searchParams.get("entityType");
    const actorType = searchParams.get("actorType");
    const action = searchParams.get("action") ?? undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const entityId = searchParams.get("entityId") ?? undefined;

    const where = {
      projectId,
      ...(entityType && Object.values(AuditEntityType).includes(entityType as AuditEntityType)
        ? { entityType: entityType as AuditEntityType }
        : {}),
      ...(actorType && Object.values(AuditActorType).includes(actorType as AuditActorType)
        ? { actorType: actorType as AuditActorType }
        : {}),
      ...(action ? { action } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    } as const;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const userIds = Array.from(
      new Set(
        logs
          .filter((log) => log.actorType === AuditActorType.USER && log.actorId)
          .map((log) => log.actorId as string)
      )
    );

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    const userLookup = new Map(users.map((u) => [u.id, u]));

    const enriched = logs.map((log) => ({
      ...log,
      actorName:
        log.actorType === AuditActorType.USER
          ? userLookup.get(log.actorId ?? "")?.name ?? userLookup.get(log.actorId ?? "")?.email ?? "User"
          : log.actorType === AuditActorType.AI
            ? "AI"
            : "System",
    }));

    return NextResponse.json({ logs: enriched, page, pageSize, total });
  });
}
