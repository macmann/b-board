import { beforeEach, describe, expect, it, vi } from "vitest";

import { IssuePriority, IssueStatus, IssueType, Role, UserRole } from "../../../lib/prismaEnums";

const mockGetUserFromRequest = vi.fn();
const mockPrisma = {
  issue: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  issueHistory: { createMany: vi.fn() },
  $transaction: vi.fn(),
};
const mockLogError = vi.fn();
const mockSafeLogAudit = vi.fn();
const mockWithRequestContext = vi.fn((_, handler) => handler());
const mockSetRequestContextUser = vi.fn();

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

vi.mock("../../../lib/auditLogger", () => ({
  __esModule: true,
  safeLogAudit: (...args: unknown[]) => mockSafeLogAudit(...args),
}));

vi.mock("../../../lib/requestContext", () => ({
  __esModule: true,
  withRequestContext: (...args: unknown[]) => mockWithRequestContext(...args),
  setRequestContextUser: (...args: unknown[]) => mockSetRequestContextUser(...args),
}));

describe("issue routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        issue: mockPrisma.issue,
        issueHistory: mockPrisma.issueHistory,
      })
    );
  });

  it("allows project product owners to delete issues", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.DEV });
    mockPrisma.issue.findUnique.mockResolvedValue({ id: "issue-1", projectId: "project-1" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.PO });
    mockPrisma.issue.delete.mockResolvedValue({ id: "issue-1" });

    const { DELETE } = await import("../issues/[issueId]/route");
    const response = await DELETE({} as any, { params: Promise.resolve({ issueId: "issue-1" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ message: "Issue deleted" });
    expect(mockPrisma.issue.delete).toHaveBeenCalledWith({ where: { id: "issue-1" } });
  });

  it("blocks deletion for non-admin, non-owner members", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-2", role: UserRole.DEV });
    mockPrisma.issue.findUnique.mockResolvedValue({ id: "issue-2", projectId: "project-2" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.DEV });

    const { DELETE } = await import("../issues/[issueId]/route");
    const response = await DELETE({} as any, { params: Promise.resolve({ issueId: "issue-2" }) });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ message: "Forbidden" });
    expect(mockPrisma.issue.delete).not.toHaveBeenCalled();
  });

  it("writes an audit log when an issue is updated", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-1", role: UserRole.ADMIN });
    const existingIssue = {
      id: "issue-1",
      projectId: "project-1",
      title: "Old title",
      description: "Old description",
      status: IssueStatus.TODO,
      priority: IssuePriority.MEDIUM,
      type: IssueType.STORY,
      storyPoints: 3,
      assigneeId: null,
      epicId: null,
      sprintId: null,
    };
    const updatedIssue = { ...existingIssue, title: "New title", priority: IssuePriority.HIGH };

    mockPrisma.issue.findUnique.mockResolvedValue(existingIssue);
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.ADMIN });
    mockPrisma.issue.update.mockResolvedValue(updatedIssue);
    mockPrisma.issueHistory.createMany.mockResolvedValue(undefined);

    const { PATCH } = await import("../issues/[issueId]/route");
    const response = await PATCH(
      { json: async () => ({ title: "New title", priority: IssuePriority.HIGH }) } as any,
      { params: Promise.resolve({ issueId: "issue-1" }) }
    );

    expect(response.status).toBe(200);
    expect(mockSafeLogAudit).toHaveBeenCalled();
    const payload = mockSafeLogAudit.mock.calls[0][0];
    expect(payload.before).toEqual({ title: "Old title", priority: IssuePriority.MEDIUM });
    expect(payload.after).toEqual({ title: "New title", priority: IssuePriority.HIGH });
  });

  it("does not block updates when audit logging fails", async () => {
    mockGetUserFromRequest.mockResolvedValue({ id: "user-3", role: UserRole.ADMIN });
    const existingIssue = {
      id: "issue-3",
      projectId: "project-9",
      title: "Stable title",
      description: null,
      status: IssueStatus.TODO,
      priority: IssuePriority.LOW,
      type: IssueType.TASK,
      storyPoints: null,
      assigneeId: null,
      epicId: null,
      sprintId: null,
    };

    const updatedIssue = { ...existingIssue, description: "New" };

    mockPrisma.issue.findUnique.mockResolvedValue(existingIssue);
    mockPrisma.projectMember.findUnique.mockResolvedValue({ role: Role.ADMIN });
    mockPrisma.issue.update.mockResolvedValue(updatedIssue);
    mockPrisma.issueHistory.createMany.mockResolvedValue(undefined);
    mockSafeLogAudit.mockRejectedValueOnce(new Error("audit failure"));

    const { PATCH } = await import("../issues/[issueId]/route");
    const response = await PATCH(
      { json: async () => ({ description: "New" }) } as any,
      { params: Promise.resolve({ issueId: "issue-3" }) }
    );

    expect(response.status).toBe(200);
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to record audit log for issue update",
      expect.any(Error)
    );
  });
});
