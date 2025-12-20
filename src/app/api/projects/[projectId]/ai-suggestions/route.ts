import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";
import { jsonError } from "@/lib/apiResponse";
import { resolveProjectId, type ProjectParams } from "@/lib/params";
import {
  AuthorizationError,
  requireProjectRole,
} from "@/lib/permissions";
import { setRequestContextUser, withRequestContext } from "@/lib/requestContext";
import { resolveIssueId } from "@/lib/issues";
import { AISuggestionStatus, AISuggestionTargetType, Role } from "@/lib/prismaEnums";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

const SUGGESTION_STATUS_SET = new Set(Object.values(AISuggestionStatus));

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Awaited<ProjectParams>> }
) {
  const params = await ctx.params;
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

    try {
      await requireProjectRole(user.id, projectId, [
        Role.ADMIN,
        Role.PO,
        Role.DEV,
        Role.QA,
        Role.VIEWER,
      ]);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return jsonError(error.message, error.status);
      }

      throw error;
    }

    const searchParams = request.nextUrl.searchParams;
    const targetParam = searchParams.get("targetId");
    const targetId = targetParam ? await resolveIssueId(projectId, targetParam) : null;

    if (targetParam && !targetId) {
      return jsonError("Target issue not found", 404);
    }
    const suggestionTypes = searchParams
      .getAll("suggestionType")
      .flatMap((value) => value.split(","))
      .filter(Boolean);
    const statuses = searchParams
      .getAll("status")
      .flatMap((value) => value.split(","))
      .filter((value) => SUGGESTION_STATUS_SET.has(value as AISuggestionStatus)) as
      | AISuggestionStatus[]
      | undefined;

    const excludeSnoozed = (searchParams.get("excludeSnoozed") ?? "true") !== "false";
    const page = Math.max(Number.parseInt(searchParams.get("page") ?? "1", 10), 1);
    const pageSize = Math.max(
      Math.min(Number.parseInt(searchParams.get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`, 10), MAX_PAGE_SIZE),
      1
    );

    const where = {
      projectId,
      targetType: AISuggestionTargetType.ISSUE,
      ...(targetId ? { targetId } : {}),
      ...(suggestionTypes.length ? { suggestionType: { in: suggestionTypes } } : {}),
      ...(statuses && statuses.length
        ? { status: { in: statuses } }
        : { status: AISuggestionStatus.PROPOSED }),
      ...(excludeSnoozed
        ? { OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }] }
        : {}),
    } as const;

    const [suggestions, total] = await Promise.all([
      prisma.aISuggestion.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.aISuggestion.count({ where }),
    ]);

    const grouped = Array.from(
      suggestions.reduce((acc, suggestion) => {
        const key = suggestion.targetId;
        if (!acc.has(key)) {
          acc.set(key, [] as typeof suggestions);
        }
        acc.get(key)!.push(suggestion);
        return acc;
      }, new Map<string, typeof suggestions>())
    ).map(([target, targetSuggestions]) => ({
      targetId: target,
      suggestions: targetSuggestions,
    }));

    return NextResponse.json(grouped, {
      headers: {
        "X-Total-Count": total.toString(),
        "X-Page": page.toString(),
        "X-Page-Size": pageSize.toString(),
      },
    });
  });
}
