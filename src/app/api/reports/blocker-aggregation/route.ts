import { Role } from "@/lib/prismaEnums";
import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import prisma from "@/lib/db";

type BlockerAggregationResponse = {
  themes: Array<{ theme: ThemeKey; count: number; examples: string[] }>;
  topBlockers: Array<{ text: string; count: number }>;
  projectsWithMostBlockers: Array<{
    projectId: string;
    projectName: string;
    count: number;
  }>;
};

type ThemeKey =
  | "AUTH"
  | "DEPLOYMENT"
  | "ENV"
  | "API"
  | "DB"
  | "UI"
  | "PEOPLE"
  | "PROCESS"
  | "OTHER";

const THEME_KEYWORDS: Array<{ theme: ThemeKey; keywords: string[] }> = [
  { theme: "AUTH", keywords: ["auth", "login", "token", "oauth", "session"] },
  {
    theme: "DEPLOYMENT",
    keywords: ["deploy", "deployment", "release", "pipeline", "ci", "cd", "rollback"],
  },
  {
    theme: "ENV",
    keywords: ["env", "environment", "staging", "prod", "uat", "sandbox", "config"],
  },
  { theme: "API", keywords: ["api", "endpoint", "request", "response", "integration"] },
  { theme: "DB", keywords: ["db", "database", "query", "sql", "postgres", "schema"] },
  { theme: "UI", keywords: ["ui", "frontend", "button", "page", "css", "layout", "react"] },
  {
    theme: "PEOPLE",
    keywords: ["approval", "review", "manager", "stakeholder", "legal", "waiting on", "oncall"],
  },
  {
    theme: "PROCESS",
    keywords: ["process", "sprint", "grooming", "backlog", "planning", "retro", "ceremony"],
  },
];

const parseDateParam = (value: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeText = (phrase: string) =>
  phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const detectTheme = (normalized: string): ThemeKey => {
  for (const { theme, keywords } of THEME_KEYWORDS) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return theme;
    }
  }

  return "OTHER";
};

const splitPhrases = (input?: string | null) => {
  if (!input) return [] as string[];

  return input
    .split(/[\n\r;\-,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const getAllowedProjectIds = async (
  user: { id: string; role: Role },
  projectId: string | null
) => {
  const leadershipRoles = new Set<Role>([Role.ADMIN, Role.PO]);

  if (leadershipRoles.has(user.role)) {
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
      projectId: true,
      blockers: true,
      dependencies: true,
    },
  });

  const themeMap = new Map<ThemeKey, { theme: ThemeKey; count: number; examples: string[] }>();
  const blockerCounts = new Map<string, { text: string; count: number }>();
  const projectCounts = new Map<string, number>();

  entries.forEach((entry) => {
    const phrases = [...splitPhrases(entry.blockers), ...splitPhrases(entry.dependencies)];

    phrases.forEach((phrase) => {
      const normalized = normalizeText(phrase);

      if (!normalized) return;

      const theme = detectTheme(normalized);
      const existingTheme = themeMap.get(theme);

      if (existingTheme) {
        existingTheme.count += 1;
        if (existingTheme.examples.length < 3) {
          existingTheme.examples.push(phrase);
        }
      } else {
        themeMap.set(theme, { theme, count: 1, examples: [phrase] });
      }

      const blockerKey = normalized;
      const currentBlocker = blockerCounts.get(blockerKey);
      if (currentBlocker) {
        currentBlocker.count += 1;
      } else {
        blockerCounts.set(blockerKey, { text: phrase, count: 1 });
      }

      projectCounts.set(entry.projectId, (projectCounts.get(entry.projectId) ?? 0) + 1);
    });
  });

  const projectIds = Array.from(projectCounts.keys());
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, name: true },
      })
    : [];
  const projectNameMap = new Map(projects.map((project) => [project.id, project.name] as const));

  const response: BlockerAggregationResponse = {
    themes: Array.from(themeMap.values()).sort((a, b) => b.count - a.count),
    topBlockers: Array.from(blockerCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    projectsWithMostBlockers: Array.from(projectCounts.entries())
      .map(([projectId, count]) => ({
        projectId,
        projectName: projectNameMap.get(projectId) ?? "Unknown project",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };

  return NextResponse.json(response);
}
