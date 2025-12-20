import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AISuggestionStatus,
  AISuggestionTargetType,
  Role,
  UserRole,
} from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockWithRequestContext = vi.fn((_, handler) => handler());
const mockSetRequestContextUser = vi.fn();
const mockPrisma = {
  aISuggestion: { findMany: vi.fn(), count: vi.fn() },
  issue: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
};

vi.mock("../../../lib/auth", () => ({
  __esModule: true,
  getUserFromRequest: (...args: unknown[]) => mockGetUserFromRequest(...args),
}));

vi.mock("../../../lib/db", () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock("../../../lib/requestContext", () => ({
  __esModule: true,
  withRequestContext: mockWithRequestContext as any,
  setRequestContextUser: (...args: unknown[]) => mockSetRequestContextUser(...args),
}));

describe("project AI suggestions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.DEV });
    mockPrisma.user.findUnique.mockResolvedValue({ role: Role.DEV });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.DEV });
    mockPrisma.aISuggestion.count.mockResolvedValue(1);
    mockPrisma.aISuggestion.findMany.mockResolvedValue([
      {
        id: "suggestion-1",
        targetId: "issue-1",
        status: AISuggestionStatus.PROPOSED,
      },
    ]);
  });

  it("resolves issue keys before filtering and restricts to issue suggestions", async () => {
    mockPrisma.issue.findFirst.mockResolvedValue({ id: "issue-123" });

    const request = new NextRequest(
      "http://localhost/api/projects/project-1/ai-suggestions?targetId=PROJ-1"
    );

    const { GET } = await import("../projects/[projectId]/ai-suggestions/route");
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(mockPrisma.aISuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "project-1",
          targetType: AISuggestionTargetType.ISSUE,
          targetId: "issue-123",
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      { targetId: "issue-1", suggestions: [{ id: "suggestion-1", targetId: "issue-1", status: "PROPOSED" }] },
    ]);
  });

  it("returns 404 when the target issue cannot be resolved", async () => {
    mockPrisma.issue.findFirst.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/projects/project-1/ai-suggestions?targetId=UNKNOWN-1"
    );

    const { GET } = await import("../projects/[projectId]/ai-suggestions/route");
    const response = await GET(request as any, {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(404);
    expect(mockPrisma.aISuggestion.findMany).not.toHaveBeenCalled();
  });
});
