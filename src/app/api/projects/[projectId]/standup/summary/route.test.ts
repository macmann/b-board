import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FakePrismaClient } from "../../../../../../test/utils/fakePrisma";
import {
  buildIssue,
  buildProjectMember,
  buildResearchItem,
  buildStandupEntry,
  buildUser,
} from "../../../../../../test/factories/standup";

const prismaHolder = vi.hoisted(() => ({ value: undefined as FakePrismaClient | undefined }));

vi.mock("@/lib/auth");
vi.mock("@/lib/db", async () => {
  const { FakePrismaClient } = await import("../../../../../../test/utils/fakePrisma");
  prismaHolder.value = new FakePrismaClient();
  return { default: prismaHolder.value };
});
vi.mock("@/lib/permissions", () => {
  class ForbiddenError extends Error {}
  return {
    ForbiddenError,
    ensureProjectRole: vi.fn(),
    PROJECT_ADMIN_ROLES: [Role.ADMIN, Role.PO],
  };
});

import * as permissions from "@/lib/permissions";
import * as auth from "@/lib/auth";
import { GET } from "./route";

const getPrisma = () => {
  if (!prismaHolder.value) throw new Error("Prisma mock not initialized");
  return prismaHolder.value;
};

const ensureProjectRole = permissions.ensureProjectRole as unknown as ReturnType<typeof vi.fn>;
const getUserFromRequest = auth.getUserFromRequest as unknown as ReturnType<typeof vi.fn>;

const createRequest = (search: Record<string, string>) => {
  const params = new URLSearchParams(search);
  const url = new URL(`http://localhost/api?${params.toString()}`);
  return { nextUrl: url } as any;
};

describe("standup summary route", () => {
  const projectId = "project-1";
  const admin = buildUser({ id: "admin-user", role: Role.ADMIN });
  const developer = buildUser({ id: "dev-user", role: Role.DEV });
  const qa = buildUser({ id: "qa-user", role: Role.QA });
  const issue = buildIssue({ id: "issue-1", projectId });
  const research = buildResearchItem({ id: "research-1", projectId });

  beforeEach(() => {
    const fakePrisma = getPrisma();
    fakePrisma.standupEntries.clear();
    fakePrisma.issues.clear();
    fakePrisma.researchItems.clear();
    fakePrisma.users.clear();
    fakePrisma.standupQualityDailyRecords.clear();
    fakePrisma.projectMembers = [];

    fakePrisma.users.set(admin.id, admin);
    fakePrisma.users.set(developer.id, developer);
    fakePrisma.users.set(qa.id, qa);

    fakePrisma.projectMembers.push(
      buildProjectMember({ projectId, userId: admin.id, role: Role.ADMIN }),
      buildProjectMember({ projectId, userId: developer.id, role: Role.DEV }),
      buildProjectMember({ projectId, userId: qa.id, role: Role.QA })
    );

    fakePrisma.issues.set(issue.id, issue);
    fakePrisma.researchItems.set(research.id, research);
    ensureProjectRole.mockResolvedValue(undefined);
    getUserFromRequest.mockResolvedValue(admin);
  });

  it("returns a summary of member completion states", async () => {
    const completeEntry = buildStandupEntry({
      id: "entry-complete",
      projectId,
      userId: admin.id,
      date: new Date("2024-01-02"),
      summaryToday: "Finished testing",
      isComplete: true,
      issues: [
        {
          standupEntryId: "entry-complete",
          issueId: issue.id,
          issue,
        },
      ] as any,
      research: [
        {
          standupEntryId: "entry-complete",
          researchItemId: research.id,
          researchItem: research,
        },
      ] as any,
    });

    const incompleteEntry = buildStandupEntry({
      id: "entry-incomplete",
      projectId,
      userId: developer.id,
      date: new Date("2024-01-02"),
      summaryToday: "Working on implementation",
      isComplete: false,
      issues: [],
    });

    const fakePrisma = getPrisma();
    fakePrisma.addEntry(completeEntry as any);
    fakePrisma.addEntry(incompleteEntry as any);

    const response = await GET(createRequest({ date: "2024-01-02" }), {
      params: { projectId },
    } as any);

    expect(ensureProjectRole).toHaveBeenCalledWith(
      getPrisma(),
      admin.id,
      projectId,
      permissions.PROJECT_ADMIN_ROLES
    );

    const body = await response.json();
    expect(body.members).toHaveLength(3);

    const [adminSummary, devSummary, qaSummary] = body.members;
    expect(adminSummary.status).toBe("submitted");
    expect(adminSummary.isComplete).toBe(true);
    expect(adminSummary.research).toHaveLength(1);

    expect(devSummary.status).toBe("submitted");
    expect(devSummary.isComplete).toBe(false);

    expect(qaSummary.status).toBe("missing");
    expect(qaSummary.isComplete).toBe(false);
  });

  it("prevents non-admin members from accessing the summary", async () => {
    ensureProjectRole.mockRejectedValueOnce(new permissions.ForbiddenError());
    getUserFromRequest.mockResolvedValueOnce(developer);

    const response = await GET(createRequest({ date: "2024-01-02" }), {
      params: { projectId },
    } as any);

    expect(response.status).toBe(403);
  });

  it("hides data quality payload for PO viewers", async () => {
    const fakePrisma = getPrisma();
    const poUser = buildUser({ id: "po-user", role: Role.PO });
    fakePrisma.users.set(poUser.id, poUser);
    fakePrisma.projectMembers.push(
      buildProjectMember({ projectId, userId: poUser.id, role: Role.PO })
    );

    getUserFromRequest.mockResolvedValueOnce(poUser);

    const response = await GET(createRequest({ date: "2024-01-02" }), {
      params: { projectId },
    } as any);

    const body = await response.json();
    expect(body.data_quality).toBeNull();
  });
});
