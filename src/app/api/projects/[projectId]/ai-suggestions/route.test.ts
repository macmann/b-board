import { NextRequest } from "next/server";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { GET } from "./route";
import { Role } from "@/lib/prismaEnums";

const prismaMock = vi.hoisted(() => ({
  issue: {
    findFirst: vi.fn(),
  },
  aISuggestion: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ __esModule: true, default: prismaMock }));

vi.mock("@/lib/auth", () => ({
  getUserFromRequest: vi.fn(async () => ({ id: "user-1", role: Role.ADMIN })),
}));

const MockAuthorizationError = vi.hoisted(() =>
  class extends Error {
    status: number;
    constructor(message = "Forbidden", status = 403) {
      super(message);
      this.status = status;
    }
  }
);

vi.mock("@/lib/permissions", () => ({
  AuthorizationError: MockAuthorizationError,
  requireProjectRole: vi.fn(async () => {}),
}));

vi.mock("@/lib/requestContext", () => ({
  withRequestContext: (_request: unknown, handler: () => Promise<unknown>) => handler(),
  setRequestContextUser: vi.fn(),
}));

describe("GET /api/projects/[projectId]/ai-suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves issue keys to IDs when filtering suggestions", async () => {
    const issue = { id: "issue-123", key: "D-4", projectId: "project-1" };

    prismaMock.issue.findFirst.mockResolvedValue({ id: issue.id });
    prismaMock.aISuggestion.findMany.mockResolvedValue([
      {
        id: "suggestion-1",
        targetId: issue.id,
        suggestionType: "IMPROVE_TEXT",
        title: "Improve wording",
      },
    ]);
    prismaMock.aISuggestion.count.mockResolvedValue(1);

    const request = new NextRequest(
      new URL(
        `http://localhost/api/projects/${issue.projectId}/ai-suggestions?targetId=${issue.key}`
      )
    );

    const response = await GET(request, { params: { projectId: issue.projectId } as any });
    const data = (await response.json()) as Array<{ targetId: string }>;

    expect(prismaMock.issue.findFirst).toHaveBeenCalledWith({
      where: { projectId: issue.projectId, key: issue.key },
      select: { id: true },
    });
    expect(data[0]?.targetId).toBe(issue.id);
  });
});
