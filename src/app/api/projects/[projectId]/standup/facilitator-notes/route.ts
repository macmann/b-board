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
import { parseDateOnly } from "@/lib/standupWindow";

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

const ensureProjectMember = async (projectId: string, userId: string) => {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { userId: true },
  });

  return member;
};

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

  try {
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const dateParam = request.nextUrl.searchParams.get("date");
  const teammateId = request.nextUrl.searchParams.get("teammateId");
  const authorIdParam = request.nextUrl.searchParams.get("authorId");
  const date = parseDateOnly(dateParam ?? new Date());

  if (!dateParam || !date || !teammateId) {
    return NextResponse.json(
      { message: "teammateId and date are required" },
      { status: 400 }
    );
  }

  const isAdmin = await getAdminStatus(user.id, projectId);

  if (!isAdmin && authorIdParam && authorIdParam !== user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const authorId = isAdmin ? authorIdParam ?? undefined : user.id;

  const teammateMember = await ensureProjectMember(projectId, teammateId);

  if (!teammateMember) {
    return NextResponse.json(
      { message: "User is not a project member" },
      { status: 404 }
    );
  }

  const notes = await prisma.facilitatorNote.findMany({
    where: {
      projectId,
      teammateId,
      date,
      ...(authorId ? { authorId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

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
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_VIEWER_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const body = await request.json().catch(() => null);
  const teammateId = typeof body?.teammateId === "string" ? body.teammateId : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const dateValue = parseDateOnly(body?.date ?? new Date());

  if (!teammateId || !dateValue) {
    return NextResponse.json(
      { message: "teammateId and date are required" },
      { status: 400 }
    );
  }

  if (!text) {
    return NextResponse.json({ message: "text is required" }, { status: 400 });
  }

  const teammateMember = await ensureProjectMember(projectId, teammateId);

  if (!teammateMember) {
    return NextResponse.json(
      { message: "User is not a project member" },
      { status: 404 }
    );
  }

  const note = await prisma.facilitatorNote.create({
    data: {
      projectId,
      teammateId,
      authorId: user.id,
      date: dateValue,
      text,
    },
  });

  return NextResponse.json(note, { status: 201 });
}
