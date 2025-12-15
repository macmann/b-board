import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AISuggestionStatus, IssueType, UserRole } from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockChatJson = vi.fn();
const mockWithRequestContext = vi.fn((_, handler) => handler());
const mockSetRequestContextUser = vi.fn();
const mockSafeLogAudit = vi.fn();

const mockPrisma = {
  project: { findUnique: vi.fn() },
  projectAISettings: { findUnique: vi.fn() },
  issue: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  aISuggestion: { create: vi.fn() },
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

vi.mock("../../../lib/ai/aiClient", () => ({
  __esModule: true,
  chatJson: (...args: unknown[]) => mockChatJson(...args),
}));

vi.mock("../../../lib/requestContext", () => ({
  __esModule: true,
  withRequestContext: (...args: unknown[]) => mockWithRequestContext(...args),
  setRequestContextUser: (...args: unknown[]) => mockSetRequestContextUser(...args),
}));

vi.mock("../../../lib/auditLogger", () => ({
  __esModule: true,
  safeLogAudit: (...args: unknown[]) => mockSafeLogAudit(...args),
}));

describe("AI autofill user story route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.DEV });
    mockPrisma.user.findUnique.mockResolvedValue({ role: UserRole.DEV });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: UserRole.DEV });
    mockPrisma.project.findUnique.mockResolvedValue({ id: "project-1", name: "Demo" });
    mockPrisma.projectAISettings.findUnique.mockResolvedValue({ backlogGroomingEnabled: true });
    mockPrisma.issue.findFirst.mockResolvedValue({ id: "issue-1" });
    mockPrisma.issue.findUnique.mockResolvedValue({
      id: "issue-1",
      title: "Missing details",
      description: "",
      type: IssueType.STORY,
    });
    mockPrisma.issue.findMany.mockResolvedValue([]);
    mockChatJson.mockResolvedValue({
      draft: {
        userStory: "As a user I want...",
        description: "Draft description",
        acceptanceCriteria: ["Given something"],
        assumptions: [],
        openQuestions: [],
        outOfScope: [],
      },
    });
    mockPrisma.aISuggestion.create.mockResolvedValue({
      id: "suggestion-1",
      suggestionType: "AUTOFILL_USER_STORY",
      status: AISuggestionStatus.PROPOSED,
      payload: {},
    });
    mockSafeLogAudit.mockResolvedValue(undefined);
  });

  it("creates an AI suggestion using the draft payload", async () => {
    const request = new NextRequest(
      "http://localhost/api/projects/project-1/issues/DEMO-1/ai/autofill",
      { method: "POST", body: JSON.stringify({ mode: "ON_DEMAND" }) }
    );

    const { POST } = await import(
      "../projects/[projectId]/issues/[issueIdOrKey]/ai/autofill/route"
    );

    const response = await POST(request as any, {
      params: { projectId: "project-1", issueIdOrKey: "DEMO-1" },
    });

    expect(response.status).toBe(201);
    expect(mockPrisma.issue.findFirst).toHaveBeenCalledWith({
      where: { projectId: "project-1", key: "DEMO-1" },
      select: { id: true },
    });
    expect(mockPrisma.aISuggestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-1",
        targetId: "issue-1",
        suggestionType: "AUTOFILL_USER_STORY",
        status: AISuggestionStatus.PROPOSED,
        payload: expect.objectContaining({ userStory: "As a user I want..." }),
      }),
    });
  });

  it("returns 409 when backlog grooming is disabled", async () => {
    mockPrisma.projectAISettings.findUnique.mockResolvedValue({ backlogGroomingEnabled: false });

    const request = new NextRequest(
      "http://localhost/api/projects/project-1/issues/issue-1/ai/autofill",
      { method: "POST" }
    );

    const { POST } = await import(
      "../projects/[projectId]/issues/[issueIdOrKey]/ai/autofill/route"
    );

    const response = await POST(request as any, {
      params: { projectId: "project-1", issueIdOrKey: "issue-1" },
    });

    expect(response.status).toBe(409);
    expect(mockChatJson).not.toHaveBeenCalled();
    expect(mockPrisma.aISuggestion.create).not.toHaveBeenCalled();
  });
});
