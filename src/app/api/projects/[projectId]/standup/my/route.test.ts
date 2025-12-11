import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FakePrismaClient } from "../../../../../../test/utils/fakePrisma";
import {
  buildIssue,
  buildProjectMember,
  buildResearchItem,
  buildUser,
} from "../../../../../../test/factories/standup";

const prismaHolder = vi.hoisted(() => ({ value: undefined as FakePrismaClient | undefined }));

vi.mock("../../../../../../lib/auth");
vi.mock("../../../../../../lib/db", async () => {
  const { FakePrismaClient } = await import("../../../../../../test/utils/fakePrisma");
  prismaHolder.value = new FakePrismaClient();
  return { default: prismaHolder.value };
});
vi.mock("../../../../../../lib/permissions", () => {
  class ForbiddenError extends Error {}
  return {
    ForbiddenError,
    ensureProjectRole: vi.fn(),
    PROJECT_VIEWER_ROLES: [Role.ADMIN, Role.PO, Role.DEV, Role.QA, Role.VIEWER],
  };
});

import * as permissions from "../../../../../../lib/permissions";
import * as auth from "../../../../../../lib/auth";
import { POST } from "./route";

const getPrisma = () => {
  if (!prismaHolder.value) throw new Error("Prisma mock not initialized");
  return prismaHolder.value;
};

const ensureProjectRole = permissions.ensureProjectRole as unknown as ReturnType<typeof vi.fn>;
const getUserFromRequest = auth.getUserFromRequest as unknown as ReturnType<typeof vi.fn>;

const createRequest = (body: Record<string, unknown>) => {
  const url = new URL("http://localhost/api");
  return {
    nextUrl: url,
    json: async () => body,
  } as any;
};

describe("standup/my route", () => {
  const projectId = "project-1";
  const user = buildUser({ id: "user-1", role: Role.DEV });
  const issue = buildIssue({ id: "issue-1", projectId });
  const researchItem = buildResearchItem({ id: "research-1", projectId });

  beforeEach(() => {
    const fakePrisma = getPrisma();
    fakePrisma.standupEntries.clear();
    fakePrisma.standupAttendances.clear();
    fakePrisma.issues.clear();
    fakePrisma.researchItems.clear();
    fakePrisma.users.clear();
    fakePrisma.projectMembers = [];
    fakePrisma.issues.set(issue.id, issue);
    fakePrisma.researchItems.set(researchItem.id, researchItem);
    fakePrisma.users.set(user.id, user);
    fakePrisma.projectMembers.push(buildProjectMember({ projectId, userId: user.id, role: Role.DEV }));
    ensureProjectRole.mockResolvedValue(undefined);
    getUserFromRequest.mockResolvedValue(user);
  });

  it("creates and updates standup entries while enforcing uniqueness", async () => {
    const request = createRequest({
      date: "2024-01-01",
      summaryToday: "Initial summary",
      issueIds: [issue.id],
    });

    const createResponse = await POST(request, { params: { projectId } });
    const created = await createResponse.json();

    expect(created.summaryToday).toBe("Initial summary");
    expect(getPrisma().standupEntries.size).toBe(1);

    const updateRequest = createRequest({
      date: "2024-01-01",
      summaryToday: "Updated summary",
      issueIds: [issue.id],
      notes: "Added note",
    });

    const updateResponse = await POST(updateRequest, { params: { projectId } });
    const updated = await updateResponse.json();

    expect(updated.summaryToday).toBe("Updated summary");
    expect(updated.notes).toBe("Added note");
    expect(updated.id).toBe(created.id);
    expect(getPrisma().standupEntries.size).toBe(1);
  });

  it("sets isComplete based on summary text and linked issues", async () => {
    const incompleteRequest = createRequest({
      date: "2024-01-02",
      summaryToday: "",
      issueIds: [issue.id],
    });

    const incompleteResponse = await POST(incompleteRequest, { params: { projectId } });
    const incomplete = await incompleteResponse.json();

    expect(incomplete.isComplete).toBe(false);

    const completeRequest = createRequest({
      date: "2024-01-02",
      summaryToday: "Wrapped up feature work",
      issueIds: [issue.id],
    });

    const completeResponse = await POST(completeRequest, { params: { projectId } });
    const complete = await completeResponse.json();

    expect(complete.isComplete).toBe(true);
  });

  it("links research items and treats them as eligible work", async () => {
    const request = createRequest({
      date: "2024-01-04",
      summaryToday: "Finishing a research spike",
      issueIds: [],
      researchIds: [researchItem.id],
    });

    const response = await POST(request, { params: { projectId } });
    const body = await response.json();

    expect(body.research).toHaveLength(1);
    expect(body.research[0].researchItem.id).toBe(researchItem.id);
    expect(body.isComplete).toBe(true);
  });

  it("rejects non-members from modifying entries", async () => {
    ensureProjectRole.mockRejectedValueOnce(new permissions.ForbiddenError());

    const request = createRequest({ date: "2024-01-03", summaryToday: "Blocked", issueIds: [issue.id] });
    const response = await POST(request, { params: { projectId } });

    expect(response.status).toBe(403);
  });
});
