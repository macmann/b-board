import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { ProjectParams, resolveProjectId } from "@/lib/params";
import {
  ForbiddenError,
  ensureProjectRole,
  PROJECT_ADMIN_ROLES,
  PROJECT_VIEWER_ROLES,
} from "@/lib/permissions";

const isValidTime = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

const toMinutes = (value: string): number | null => {
  const [hoursStr, minutesStr] = value.split(":");
  const hours = Number.parseInt(hoursStr ?? "", 10);
  const minutes = Number.parseInt(minutesStr ?? "", 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const mapResponse = (settings: {
  standupWindowStart: string | null;
  standupWindowEnd: string | null;
  standupWeekendDisabled: boolean | null;
}) => ({
  standupWindowStart: settings.standupWindowStart,
  standupWindowEnd: settings.standupWindowEnd,
  standupWeekendDisabled: settings.standupWeekendDisabled ?? false,
  enabled: Boolean(settings.standupWindowStart && settings.standupWindowEnd),
});

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

  const settings = await prisma.projectSettings.findUnique({
    where: { projectId },
  });

  return NextResponse.json(
    mapResponse({
      standupWindowStart: settings?.standupWindowStart ?? null,
      standupWindowEnd: settings?.standupWindowEnd ?? null,
      standupWeekendDisabled: settings?.standupWeekendDisabled ?? false,
    })
  );
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

  const body = await request.json();
  const {
    enabled,
    standupWindowStart,
    standupWindowEnd,
    standupWeekendDisabled,
  } = body ?? {};

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { message: "enabled must be provided as a boolean" },
      { status: 400 }
    );
  }

  if (
    standupWeekendDisabled !== undefined &&
    typeof standupWeekendDisabled !== "boolean"
  ) {
    return NextResponse.json(
      { message: "standupWeekendDisabled must be a boolean when provided." },
      { status: 400 }
    );
  }

  const weekendDisabled = standupWeekendDisabled ?? false;

  if (enabled) {
    if (!isValidTime(standupWindowStart) || !isValidTime(standupWindowEnd)) {
      return NextResponse.json(
        { message: "Start and end times must be provided in HH:mm format." },
        { status: 400 }
      );
    }

    const startMinutes = toMinutes(standupWindowStart);
    const endMinutes = toMinutes(standupWindowEnd);

    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes
    ) {
      return NextResponse.json(
        { message: "End time must be later than start time." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.projectSettings.upsert({
    where: { projectId },
    update: {
      standupWindowStart: enabled ? standupWindowStart : null,
      standupWindowEnd: enabled ? standupWindowEnd : null,
      standupWeekendDisabled: weekendDisabled,
    },
    create: {
      projectId,
      standupWindowStart: enabled ? standupWindowStart : null,
      standupWindowEnd: enabled ? standupWindowEnd : null,
      standupWeekendDisabled: weekendDisabled,
    },
  });

  return NextResponse.json(mapResponse(updated));
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
  return PUT(request, { params: Promise.resolve(params) });
}
