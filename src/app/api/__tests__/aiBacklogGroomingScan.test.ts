import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AISuggestionStatus, IssuePriority, IssueStatus, IssueType, UserRole } from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockSafeLogAudit = vi.fn();
const mockChatJson = vi.fn();
const mockWithRequestContext = vi.fn((_, handler) => handler());
const mockSetRequestContextUser = vi.fn();

const mockPrisma = {
  project: { findUnique: vi.fn() },
  projectAISettings: { findUnique: vi.fn() },
  issue: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  aIRun: { create: vi.fn(), update: vi.fn() },
  aISuggestion: { findMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
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

vi.mock("../../../lib/auditLogger", () => ({
  __esModule: true,
  safeLogAudit: (...args: unknown[]) => mockSafeLogAudit(...args),
}));

vi.mock("../../../lib/ai/aiClient", () => ({
  __esModule: true,
  chatJson: (...args: unknown[]) => mockChatJson(...args),
}));

vi.mock("../../../lib/requestContext", () => ({
  __esModule: true,
  withRequestContext: mockWithRequestContext as any,
  setRequestContextUser: (...args: unknown[]) => mockSetRequestContextUser(...args),
}));

describe("backlog grooming scan route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        aISuggestion: mockPrisma.aISuggestion,
        aIRun: mockPrisma.aIRun,
      })
    );

    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.DEV });
    mockPrisma.project.findUnique.mockResolvedValue({ id: "project-1", name: "Demo" });
    mockPrisma.projectAISettings.findUnique.mockResolvedValue({
      backlogGroomingEnabled: true,
      projectBrief: "Make a great product",
    });
    mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.DEV });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: UserRole.DEV });
    mockSafeLogAudit.mockResolvedValue(undefined);
    mockPrisma.issue.findMany.mockResolvedValue([
      {
        id: "issue-1",
        key: "DEMO-1",
        title: "Story missing info",
        description: "As a user I want ...",
        priority: IssuePriority.MEDIUM,
        type: IssueType.STORY,
        status: IssueStatus.TODO,
      },
    ]);
    mockPrisma.aIRun.create.mockResolvedValue({ id: "run-1" });
    mockPrisma.aISuggestion.findMany.mockResolvedValue([
      {
        targetId: "issue-1",
        suggestionType: "INCOMPLETE_STORY_FLAG",
        status: AISuggestionStatus.PROPOSED,
        payload: { code: "MISSING_DESCRIPTION" },
      },
    ]);
    mockChatJson.mockResolvedValue({
      flagged: [
        {
          issueId: "DEMO-1",
          flags: [
            {
              code: "MISSING_DESCRIPTION",
              title: "Add a description",
              rationaleBullets: ["No description provided"],
              confidence: 0.9,
            },
            {
              code: "MISSING_AC",
              title: "Add acceptance criteria",
              rationaleBullets: ["Acceptance Criteria section missing"],
              confidence: 0.8,
            },
          ],
        },
      ],
    });
  });

  it("skips duplicate flags from the last 7 days", async () => {
    const request = new NextRequest("http://localhost/api/projects/project-1/ai/backlog-grooming/scan", {
      method: "POST",
      body: JSON.stringify({ limit: 5 }),
    });

    const { POST } = await import("../projects/[projectId]/ai/backlog-grooming/scan/route");

    const response = await POST(request as any, { params: Promise.resolve({ projectId: "project-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ runId: "run-1", flaggedCount: 1 });

    expect(mockPrisma.aISuggestion.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          targetId: "issue-1",
          suggestionType: "INCOMPLETE_STORY_FLAG",
          payload: expect.objectContaining({ code: "MISSING_AC" }),
        }),
      ],
    });
  });
});
