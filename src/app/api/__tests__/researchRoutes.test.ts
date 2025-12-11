import { describe, expect, it, beforeEach, vi } from "vitest";
import { ResearchStatus } from "../../../lib/prismaEnums";

vi.mock("@prisma/client", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code = "";
    },
  },
  ResearchObservationType: { NOTE: "NOTE", SUMMARY: "SUMMARY" },
  ResearchPriority: { LOW: "LOW", HIGH: "HIGH" },
  ResearchDecision: { ACCEPTED: "ACCEPTED", REJECTED: "REJECTED" },
}));

const { ResearchObservationType } = await import("@prisma/client");

const mockGetUserFromRequest = vi.fn();
const mockEnsureProjectRole = vi.fn();
const mockGetNextResearchKey = vi.fn();

const mockPrisma = {
  project: { findUnique: vi.fn() },
  projectMember: { findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  researchItem: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  researchObservation: { findMany: vi.fn(), create: vi.fn() },
  researchItemIssueLink: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  issue: { findUnique: vi.fn() },
};

class MockForbiddenError extends Error {
  statusCode = 403;
}

vi.mock("../../../lib/auth", () => ({
  __esModule: true,
  getUserFromRequest: mockGetUserFromRequest,
}));

vi.mock("../../../lib/permissions", () => ({
  __esModule: true,
  ensureProjectRole: mockEnsureProjectRole,
  ForbiddenError: MockForbiddenError,
  PROJECT_CONTRIBUTOR_ROLES: ["CONTRIBUTOR"],
  PROJECT_VIEWER_ROLES: ["VIEWER"],
}));

vi.mock("../../../lib/db", () => ({
  __esModule: true,
  default: mockPrisma,
  prisma: mockPrisma,
}));

vi.mock("../../../lib/researchKey", () => ({
  __esModule: true,
  getNextResearchKey: mockGetNextResearchKey,
}));

type RequestInit = {
  body?: unknown;
  search?: string;
};

function createRequest({ body, search }: RequestInit = {}) {
  return {
    json: async () => body,
    nextUrl: new URL(`http://localhost${search ?? ""}`),
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetNextResearchKey.mockResolvedValue("DR-1");
  mockPrisma.researchItem.aggregate.mockResolvedValue({ _max: { position: null } });
});

describe("research item routes", () => {
  it("creates a research item when authorized", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "project1",
      enableResearchBoard: true,
    });
    mockPrisma.projectMember.findFirst.mockResolvedValue({ id: "member1" });
    const createdItem = { id: "r1", key: "DR-1", title: "New idea" };
    mockPrisma.researchItem.create.mockResolvedValue(createdItem);

    const { POST } = await import("../projects/[projectId]/research-items/route");
    const response = await POST(
      createRequest({
        body: { title: "New idea", description: "Details", dueDate: "2024-01-01" },
      }),
      { params: { projectId: "project1" } }
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(createdItem);
    expect(mockPrisma.researchItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: "DR-1",
          title: "New idea",
          description: "Details",
          dueDate: new Date("2024-01-01"),
        }),
      })
    );
    expect(mockGetNextResearchKey).toHaveBeenCalledWith(mockPrisma, "project1");
    expect(mockEnsureProjectRole).toHaveBeenCalled();
  });

  it("rejects creation when research board is disabled", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.project.findUnique.mockResolvedValue({
      id: "project1",
      enableResearchBoard: false,
    });

    const { POST } = await import("../projects/[projectId]/research-items/route");
    const response = await POST(createRequest({ body: { title: "Disabled" } }), {
      params: { projectId: "project1" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("Research board is disabled"),
    });
  });

  it("updates a research item when permitted", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.researchItem.findUnique.mockResolvedValue({
      id: "r1",
      projectId: "project1",
      project: { id: "project1", enableResearchBoard: true },
      assignee: null,
    });
    mockPrisma.projectMember.findFirst.mockResolvedValue({ id: "member1" });
    mockPrisma.researchItem.update.mockResolvedValue({
      id: "r1",
      status: ResearchStatus.COMPLETED,
    });

    const { PATCH } = await import("../research-items/[researchItemId]/route");
    const response = await PATCH(
      createRequest({ body: { status: ResearchStatus.COMPLETED, assigneeId: "user2" } }),
      { params: { researchItemId: "r1" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "r1",
      status: ResearchStatus.COMPLETED,
    });
    expect(mockPrisma.researchItem.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: expect.objectContaining({ status: ResearchStatus.COMPLETED }),
    });
  });

  it("returns detailed data including the key", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    const mockDetail = {
      id: "r1",
      key: "DR-7",
      title: "Existing research",
      projectId: "project1",
      description: null,
      assigneeId: null,
      assignee: null,
      dueDate: null,
      status: ResearchStatus.BACKLOG,
      priority: "LOW",
      decision: "PENDING",
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      project: { id: "project1", enableResearchBoard: true },
    };
    mockPrisma.researchItem.findUnique.mockResolvedValue(mockDetail);

    const { GET } = await import("../research-items/[researchItemId]/route");
    const response = await GET(createRequest(), { params: { researchItemId: "r1" } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "r1",
      key: "DR-7",
      title: "Existing research",
    });
  });

  it("blocks updates when research board is disabled", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.researchItem.findUnique.mockResolvedValue({
      id: "r1",
      projectId: "project1",
      project: { id: "project1", enableResearchBoard: false },
    });

    const { PATCH } = await import("../research-items/[researchItemId]/route");
    const response = await PATCH(createRequest({ body: { title: "Nope" } }), {
      params: { researchItemId: "r1" },
    });

    expect(response.status).toBe(403);
  });
});

describe("observation routes", () => {
  it("prevents adding observations to archived items", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.researchItem.findUnique.mockResolvedValue({
      id: "r1",
      projectId: "project1",
      project: { id: "project1", enableResearchBoard: true },
      status: ResearchStatus.ARCHIVED,
    });

    const { POST } = await import("../research-items/[researchItemId]/observations/route");
    const response = await POST(
      createRequest({
        body: { type: ResearchObservationType.NOTE, content: "Some note" },
      }),
      { params: { researchItemId: "r1" } }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("archived"),
    });
  });
});

describe("issue linking routes", () => {
  it("rejects linking issues from another project", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.researchItem.findUnique.mockResolvedValue({
      id: "r1",
      projectId: "project1",
      project: { id: "project1", enableResearchBoard: true },
      status: ResearchStatus.IN_PROGRESS,
    });
    mockPrisma.issue.findUnique.mockResolvedValue({ id: "i1", projectId: "other" });

    const { POST } = await import("../research-items/[researchItemId]/issues/route");
    const response = await POST(createRequest({ body: { issueId: "i1" } }), {
      params: { researchItemId: "r1" },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("same project"),
    });
  });

  it("returns disabled response when board is off", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user1" });
    mockPrisma.researchItem.findUnique.mockResolvedValue({
      id: "r1",
      projectId: "project1",
      project: { id: "project1", enableResearchBoard: false },
      status: ResearchStatus.IN_PROGRESS,
    });

    const { POST } = await import("../research-items/[researchItemId]/issues/route");
    const response = await POST(createRequest({ body: { issueId: "i1" } }), {
      params: { researchItemId: "r1" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      message: expect.stringContaining("Research board is disabled"),
    });
  });
});
