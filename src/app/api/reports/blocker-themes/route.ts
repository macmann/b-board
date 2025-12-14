import { Role } from "@/lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";

type ThemeResult = { theme: string; count: number; examples: string[] };

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "of",
  "to",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "is",
  "was",
  "are",
  "be",
  "this",
  "that",
  "it",
]);

const THEME_KEYWORDS: Array<{ theme: ThemeResult["theme"]; keywords: string[] }> = [
  { theme: "Backend/API", keywords: ["api", "backend", "endpoint"] },
  { theme: "Frontend/UI", keywords: ["ui", "frontend", "css"] },
  { theme: "Deployment/Build", keywords: ["deploy", "render", "build", "prisma"] },
  { theme: "Requirements", keywords: ["requirements", "spec", "clarify"] },
  { theme: "Access/Permissions", keywords: ["access", "permission", "role"] },
];

const parseDateParam = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const sanitizeText = (input: string) => {
  const lower = input.toLowerCase().trim();
  const noPunctuation = lower.replace(/[^a-z0-9\s]/g, " ");
  const words = noPunctuation
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));

  return words.join(" ");
};

const detectTheme = (normalized: string): ThemeResult["theme"] => {
  const words = normalized.split(" ");

  for (const { theme, keywords } of THEME_KEYWORDS) {
    if (words.some((word) => keywords.includes(word))) {
      return theme;
    }
  }

  return "Other";
};

const splitPhrases = (input: string) =>
  input
    .split(/[\n\r;\-,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const getAllowedProjectIds = async (
  user: { id: string; role: Role },
  projectId: string | null
) => {
  if (user.role === Role.ADMIN) {
    return projectId ? [projectId] : null;
  }

  const memberships = await prisma.projectMember.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });

  const memberProjects = memberships.map((membership) => membership.projectId);

  if (projectId) {
    if (!memberProjects.includes(projectId)) {
      return [];
    }
    return [projectId];
  }

  return memberProjects;
};

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = parseDateParam(searchParams.get("from"));
  const to = parseDateParam(searchParams.get("to"));
  const projectParam = searchParams.get("projectId");
  const projectId = projectParam && projectParam !== "all" ? projectParam : null;

  if (!from || !to || to < from) {
    return NextResponse.json({ message: "Invalid date range" }, { status: 400 });
  }

  const allowedProjectIds = await getAllowedProjectIds(user, projectId);

  if (allowedProjectIds && allowedProjectIds.length === 0) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const whereClause = {
    date: { gte: from, lte: to },
    ...(allowedProjectIds ? { projectId: { in: allowedProjectIds } } : {}),
  } as const;

  const entries = await prisma.dailyStandupEntry.findMany({
    where: whereClause,
    select: {
      blockers: true,
    },
  });

  const themeMap = new Map<string, ThemeResult>();

  entries.forEach((entry) => {
    const blockersText = entry.blockers ?? "";
    const phrases = splitPhrases(blockersText);

    phrases.forEach((phrase) => {
      const normalized = sanitizeText(phrase);

      if (!normalized) {
        return;
      }

      const theme = detectTheme(normalized);
      const existing = themeMap.get(theme);

      if (existing) {
        existing.count += 1;
        if (existing.examples.length < 3) {
          existing.examples.push(phrase);
        }
      } else {
        themeMap.set(theme, {
          theme,
          count: 1,
          examples: [phrase],
        });
      }
    });
  });

  const themes = Array.from(themeMap.values()).sort((a, b) => b.count - a.count);

  return NextResponse.json({ themes });
}
