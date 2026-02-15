import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  ensureProjectRole,
  ForbiddenError,
  PROJECT_ADMIN_ROLES,
} from "@/lib/permissions";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import { parseDateOnly } from "@/lib/standupWindow";

const actionStateValues = ["OPEN", "DONE", "SNOOZED", "DISMISSED"] as const;
type ActionStateValue = (typeof actionStateValues)[number];

const isActionStateValue = (value: string): value is ActionStateValue =>
  actionStateValues.includes(value as ActionStateValue);

const toDateOnlyString = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : null;

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
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const date = parseDateOnly(request.nextUrl.searchParams.get("date"));

  if (!date) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  const actionStateModel = (prisma as any).standupActionState;
  if (!actionStateModel?.findMany) {
    return NextResponse.json({ date: toDateOnlyString(date), action_states: [] });
  }

  const records = await actionStateModel.findMany({
    where: {
      projectId,
      userId: user.id,
      date,
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    date: toDateOnlyString(date),
    action_states: records.map((record: any) => ({
      action_id: record.actionId,
      state: record.state,
      snooze_until: toDateOnlyString(record.snoozeUntil),
      summary_version: record.summaryVersion ?? null,
      client_event_id: record.clientEventId ?? null,
      updated_at: record.updatedAt,
    })),
  });
}

export async function PUT(
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
    await ensureProjectRole(prisma, user.id, projectId, PROJECT_ADMIN_ROLES);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    throw error;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        date?: string;
        action_id?: string;
        state?: string;
        snooze_until?: string | null;
        summary_version?: number;
        client_event_id?: string;
      }
    | null;

  if (!body?.date || !body.action_id || !body.state || !isActionStateValue(body.state)) {
    return NextResponse.json(
      { message: "date, action_id and valid state are required" },
      { status: 400 }
    );
  }

  const date = parseDateOnly(body.date);
  if (!date) {
    return NextResponse.json({ message: "Invalid date" }, { status: 400 });
  }

  const snoozeUntil = body.snooze_until ? parseDateOnly(body.snooze_until) : null;

  const actionStateModel = (prisma as any).standupActionState;
  if (!actionStateModel?.upsert) {
    return NextResponse.json(
      { message: "Action state persistence is not available in this environment" },
      { status: 503 }
    );
  }

  const record = await actionStateModel.upsert({
    where: {
      projectId_userId_date_actionId: {
        projectId,
        userId: user.id,
        date,
        actionId: body.action_id,
      },
    },
    update: {
      state: body.state,
      snoozeUntil,
      summaryVersion: body.summary_version ?? null,
      clientEventId: body.client_event_id ?? null,
      metadata: {
        projectId,
        userId: user.id,
        actionId: body.action_id,
      },
    },
    create: {
      projectId,
      userId: user.id,
      date,
      actionId: body.action_id,
      state: body.state,
      snoozeUntil,
      summaryVersion: body.summary_version ?? null,
      clientEventId: body.client_event_id ?? null,
      metadata: {
        projectId,
        userId: user.id,
        actionId: body.action_id,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    action_state: {
      action_id: record.actionId,
      state: record.state,
      snooze_until: toDateOnlyString(record.snoozeUntil),
      updated_at: record.updatedAt,
    },
  });
}
