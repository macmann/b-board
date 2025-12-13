import { beforeEach, describe, expect, it, vi } from "vitest";

import { Role, UserRole } from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockPrisma = {
  issue: { findUnique: vi.fn(), delete: vi.fn() },
  projectMember: { findUnique: vi.fn() },
};
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

vi.mock("../../../lib/logger", () => ({
  __esModule: true,
  logError: mockLogError,
}));

describe("issue routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows project product owners to delete issues", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.MEMBER });
    mockPrisma.issue.findUnique.mockResolvedValue({ id: "issue-1", projectId: "project-1" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.PO });
    mockPrisma.issue.delete.mockResolvedValue({ id: "issue-1" });

    const { DELETE } = await import("../issues/[issueId]/route");
    const response = await DELETE({} as any, { params: { issueId: "issue-1" } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ message: "Issue deleted" });
    expect(mockPrisma.issue.delete).toHaveBeenCalledWith({ where: { id: "issue-1" } });
  });

  it("blocks deletion for non-admin, non-owner members", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-2", role: UserRole.MEMBER });
    mockPrisma.issue.findUnique.mockResolvedValue({ id: "issue-2", projectId: "project-2" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.DEV });

    const { DELETE } = await import("../issues/[issueId]/route");
    const response = await DELETE({} as any, { params: { issueId: "issue-2" } });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ message: "Forbidden" });
    expect(mockPrisma.issue.delete).not.toHaveBeenCalled();
  });
});
