import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role, UserRole } from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockPrisma = {
  projectAISettings: { findUnique: vi.fn(), upsert: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
};
const mockSafeLogAudit = vi.fn();
const mockLogError = vi.fn();

vi.mock("../../../lib/auth", () => ({
  __esModule: true,
  getUserFromRequest: mockGetUserFromRequest,
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

vi.mock("../../../lib/logger", () => ({
  __esModule: true,
  logError: (...args: unknown[]) => mockLogError(...args),
}));

describe("project AI settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.projectAISettings.findUnique.mockResolvedValue(null);
    process.env.AI_MODEL_DEFAULT = "gpt-default";
  });

  it("returns default settings for project viewers", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.DEV });
    mockPrisma.user.findUnique.mockResolvedValue({ role: Role.DEV });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.DEV });

    const { GET } = await import("../projects/[projectId]/ai-settings/route");
    const response = await GET({} as any, {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      backlogGroomingEnabled: false,
      model: "gpt-default",
      temperature: null,
      projectBrief: null,
    });
  });

  it("blocks updates for non-admin project members", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-2", role: UserRole.DEV });
    mockPrisma.user.findUnique.mockResolvedValue({ role: Role.DEV });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.DEV });

    const { PUT } = await import("../projects/[projectId]/ai-settings/route");
    const response = await PUT(
      { json: async () => ({ backlogGroomingEnabled: true }) } as any,
      { params: Promise.resolve({ projectId: "project-2" }) }
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.projectAISettings.upsert).not.toHaveBeenCalled();
  });

  it("validates temperature input", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-3", role: UserRole.PO });
    mockPrisma.user.findUnique.mockResolvedValue({ role: Role.PO });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.PO });

    const { PUT } = await import("../projects/[projectId]/ai-settings/route");
    const response = await PUT(
      { json: async () => ({ backlogGroomingEnabled: true, temperature: 5 }) } as any,
      { params: Promise.resolve({ projectId: "project-3" }) }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      message: "temperature must be between 0 and 2",
    });
  });

  it("updates settings and writes an audit log", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-4", role: UserRole.PO });
    mockPrisma.user.findUnique.mockResolvedValue({ role: Role.PO });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.PO });
    mockPrisma.projectAISettings.findUnique.mockResolvedValue({
      id: "settings-1",
      projectId: "project-4",
      backlogGroomingEnabled: false,
      model: null,
      temperature: null,
      projectBrief: "Old brief",
    });
    mockPrisma.projectAISettings.upsert.mockResolvedValue({
      id: "settings-1",
      projectId: "project-4",
      backlogGroomingEnabled: true,
      model: "gpt-4",
      temperature: 0.7,
      projectBrief: "New brief",
    });

    const { PUT } = await import("../projects/[projectId]/ai-settings/route");
    const response = await PUT(
      {
        json: async () => ({
          backlogGroomingEnabled: true,
          model: "gpt-4",
          temperature: 0.7,
          projectBrief: "New brief",
        }),
      } as any,
      { params: Promise.resolve({ projectId: "project-4" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      backlogGroomingEnabled: true,
      model: "gpt-4",
      temperature: 0.7,
      projectBrief: "New brief",
    });

    expect(mockPrisma.projectAISettings.upsert).toHaveBeenCalledWith({
      where: { projectId: "project-4" },
      update: {
        backlogGroomingEnabled: true,
        model: "gpt-4",
        temperature: 0.7,
        projectBrief: "New brief",
      },
      create: {
        projectId: "project-4",
        backlogGroomingEnabled: true,
        model: "gpt-4",
        temperature: 0.7,
        projectBrief: "New brief",
      },
    });

    expect(mockSafeLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PROJECT_AI_SETTINGS_UPDATED",
        actorId: "user-4",
        entityId: "settings-1",
      })
    );
  });
});
