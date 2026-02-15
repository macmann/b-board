import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { PROJECT_ADMIN_ROLES } from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";

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

  const body = (await request.json().catch(() => null)) as
    | {
        entry_id?: string;
        question_id?: string;
        answer?: string;
        status?: "ANSWERED" | "DISMISSED";
        dismissed_until?: string | null;
      }
    | null;

  if (!body?.entry_id || !body?.question_id) {
    return NextResponse.json(
      { message: "entry_id and question_id are required" },
      { status: 400 }
    );
  }

  const status = body.status ?? "ANSWERED";

  if (status === "ANSWERED" && !body?.answer?.trim()) {
    return NextResponse.json(
      { message: "answer is required when status is ANSWERED" },
      { status: 400 }
    );
  }

  const entry = await prisma.dailyStandupEntry.findUnique({
    where: { id: body.entry_id },
    select: { id: true, projectId: true, userId: true, date: true },
  });

  if (!entry || entry.projectId !== projectId) {
    return NextResponse.json({ message: "Standup entry not found" }, { status: 404 });
  }

  const userMembership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
    select: { role: true },
  });

  const isGlobalAdmin = user.role === "ADMIN";
  const isProjectAdmin = Boolean(userMembership && PROJECT_ADMIN_ROLES.includes(userMembership.role as any));
  const isAssignee = entry.userId === user.id;

  if (!isGlobalAdmin && !isProjectAdmin && !isAssignee) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const dismissedUntil =
    status === "DISMISSED"
      ? body.dismissed_until
        ? new Date(body.dismissed_until)
        : entry.date
      : null;

  if (dismissedUntil && Number.isNaN(dismissedUntil.getTime())) {
    return NextResponse.json(
      { message: "dismissed_until must be a valid date" },
      { status: 400 }
    );
  }

  const clarificationModel = (prisma as any).standupEntryClarification;
  if (!clarificationModel?.upsert) {
    return NextResponse.json(
      { message: "Clarification storage is not available in this environment" },
      { status: 503 }
    );
  }

  const record = await clarificationModel.upsert({
    where: {
      entryId_questionId: {
        entryId: body.entry_id,
        questionId: body.question_id,
      },
    },
    update: {
      answer: status === "ANSWERED" ? body.answer?.trim() : null,
      status,
      dismissedUntil,
      createdById: user.id,
    },
    create: {
      projectId,
      entryId: body.entry_id,
      questionId: body.question_id,
      answer: status === "ANSWERED" ? body.answer?.trim() : null,
      status,
      dismissedUntil,
      createdById: user.id,
    },
  });

  return NextResponse.json({
    ok: true,
    clarification: {
      id: record.id,
      entry_id: record.entryId,
      question_id: record.questionId,
      answer: record.answer,
      status: record.status,
      dismissed_until: record.dismissedUntil,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
    },
  });
}
