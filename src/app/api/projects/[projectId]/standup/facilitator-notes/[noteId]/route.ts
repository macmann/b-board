import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { Role } from "@/lib/prismaEnums";

const getAdminStatus = async (userId: string, projectId: string) => {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    }),
  ]);

  return user?.role === Role.ADMIN || membership?.role === Role.ADMIN;
};

const loadNote = async (projectId: string, noteId: string) => {
  return prisma.facilitatorNote.findFirst({
    where: { id: noteId, projectId },
  });
};

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams> & { noteId?: string }> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);
  const noteId = params.noteId;

  if (!projectId || !noteId) {
    return NextResponse.json(
      { message: "projectId and noteId are required" },
      { status: 400 }
    );
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const note = await loadNote(projectId, noteId);

  if (!note) {
    return NextResponse.json({ message: "Note not found" }, { status: 404 });
  }

  const isAdmin = await getAdminStatus(user.id, projectId);

  if (!isAdmin && note.authorId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : undefined;
  const resolved =
    typeof body?.resolved === "boolean" ? body.resolved : undefined;

  if (text !== undefined && !text) {
    return NextResponse.json({ message: "text is required" }, { status: 400 });
  }

  if (text === undefined && resolved === undefined) {
    return NextResponse.json(
      { message: "No updates provided" },
      { status: 400 }
    );
  }

  const resolvedAt =
    resolved === undefined
      ? undefined
      : resolved
      ? new Date()
      : null;

  const updated = await prisma.facilitatorNote.update({
    where: { id: note.id },
    data: {
      ...(text !== undefined ? { text } : {}),
      ...(resolved !== undefined ? { resolved, resolvedAt } : {}),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams> & { noteId?: string }> }
) {
  const params = await ctx.params;
  const projectId = await resolveProjectId(params);
  const noteId = params.noteId;

  if (!projectId || !noteId) {
    return NextResponse.json(
      { message: "projectId and noteId are required" },
      { status: 400 }
    );
  }

  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const note = await loadNote(projectId, noteId);

  if (!note) {
    return NextResponse.json({ message: "Note not found" }, { status: 404 });
  }

  const isAdmin = await getAdminStatus(user.id, projectId);

  if (!isAdmin && note.authorId !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.facilitatorNote.delete({ where: { id: note.id } });

  return NextResponse.json({ ok: true });
}
