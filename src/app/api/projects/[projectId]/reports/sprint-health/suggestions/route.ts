import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  ForbiddenError,
  ensureProjectRole,
  PROJECT_ADMIN_ROLES,
} from "@/lib/permissions";

const stateValues = ["OPEN", "ACCEPTED", "DISMISSED", "SNOOZED"] as const;
type SuggestionState = (typeof stateValues)[number];

const isSuggestionState = (value: string): value is SuggestionState =>
  stateValues.includes(value as SuggestionState);

const parseDateOnly = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDateOnly = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : null;

const mapEventType = (state: SuggestionState) => {
  if (state === "ACCEPTED") return "SUGGESTION_ACCEPTED" as const;
  if (state === "DISMISSED") return "SUGGESTION_DISMISSED" as const;
  if (state === "SNOOZED") return "SUGGESTION_SNOOZED" as const;
  return "SUGGESTION_VIEWED" as const;
};

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
        sprint_id?: string | null;
        suggestion_id?: string;
        suggestion_type?: string;
        state?: string;
        dismissed_until?: string | null;
        snoozed_until?: string | null;
        viewed?: boolean;
      }
    | null;

  const date = parseDateOnly(body?.date);
  if (!date) {
    return NextResponse.json({ message: "date is required" }, { status: 400 });
  }

  const suggestionStateModel = (prisma as any).sprintGuidanceSuggestionState;
  if (!suggestionStateModel?.upsert) {
    return NextResponse.json(
      { message: "Suggestion lifecycle persistence is not available in this environment" },
      { status: 503 }
    );
  }

  if (body?.viewed) {
    await (prisma as any).coordinationEvent?.create?.({
      data: {
        projectId,
        targetUserId: user.id,
        eventType: "SUGGESTION_VIEWED",
        relatedEntityId: body.suggestion_id ?? null,
        metadata: {
          suggestionId: body.suggestion_id ?? null,
          suggestionType: body.suggestion_type ?? null,
          date: toDateOnly(date),
        },
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (!body?.suggestion_id || !body.suggestion_type || !body.state || !isSuggestionState(body.state)) {
    return NextResponse.json(
      { message: "suggestion_id, suggestion_type and valid state are required" },
      { status: 400 }
    );
  }

  const dismissedUntil = parseDateOnly(body.dismissed_until ?? null);
  const snoozedUntil = parseDateOnly(body.snoozed_until ?? null);

  const record = await suggestionStateModel.upsert({
    where: {
      projectId_userId_date_suggestionId: {
        projectId,
        userId: user.id,
        date,
        suggestionId: body.suggestion_id,
      },
    },
    update: {
      sprintId: body.sprint_id ?? null,
      suggestionType: body.suggestion_type,
      suggestionState: body.state,
      dismissedUntil,
      snoozedUntil,
      acceptedAt: body.state === "ACCEPTED" ? new Date() : null,
    },
    create: {
      projectId,
      userId: user.id,
      sprintId: body.sprint_id ?? null,
      date,
      suggestionId: body.suggestion_id,
      suggestionType: body.suggestion_type,
      suggestionState: body.state,
      dismissedUntil,
      snoozedUntil,
      acceptedAt: body.state === "ACCEPTED" ? new Date() : null,
    },
  });

  await (prisma as any).coordinationEvent?.create?.({
    data: {
      projectId,
      targetUserId: user.id,
      eventType: mapEventType(body.state),
      relatedEntityId: body.suggestion_id,
      metadata: {
        suggestionId: body.suggestion_id,
        suggestionType: body.suggestion_type,
        state: body.state,
        date: toDateOnly(date),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    suggestion_state: {
      suggestion_id: record.suggestionId,
      suggestion_type: record.suggestionType,
      state: record.suggestionState,
      dismissed_until: toDateOnly(record.dismissedUntil),
      snoozed_until: toDateOnly(record.snoozedUntil),
      accepted_at: record.acceptedAt,
    },
  });
}
