import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FakePrismaClient } from "../../../../../../test/utils/fakePrisma";
import {
  buildProjectMember,
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

import * as auth from "@/lib/auth";
import { POST } from "./route";

const getPrisma = () => {
  if (!prismaHolder.value) throw new Error("Prisma mock not initialized");
  return prismaHolder.value;
};

const getUserFromRequest = auth.getUserFromRequest as unknown as ReturnType<typeof vi.fn>;

const createRequest = (body: Record<string, unknown>) => {
  const url = new URL("http://localhost/api");
  return {
    nextUrl: url,
    json: async () => body,
  } as any;
};

describe("standup/clarifications route", () => {
  const projectId = "project-1";
  const assignee = buildUser({ id: "assignee-user", role: Role.DEV });
  const po = buildUser({ id: "po-user", role: Role.PO });
  const outsider = buildUser({ id: "outsider-user", role: Role.DEV });

  beforeEach(() => {
    const fakePrisma = getPrisma();
    fakePrisma.standupEntries.clear();
    fakePrisma.standupClarifications.clear();
    fakePrisma.users.clear();
    fakePrisma.projectMembers = [];

    fakePrisma.users.set(assignee.id, assignee);
    fakePrisma.users.set(po.id, po);
    fakePrisma.users.set(outsider.id, outsider);

    fakePrisma.projectMembers.push(
      buildProjectMember({ projectId, userId: assignee.id, role: Role.DEV }),
      buildProjectMember({ projectId, userId: po.id, role: Role.PO })
    );

    fakePrisma.addEntry(
      buildStandupEntry({
        id: "entry-1",
        projectId,
        userId: assignee.id,
        date: new Date("2024-01-02"),
        summaryToday: "Working on API",
      }) as any
    );

    getUserFromRequest.mockResolvedValue(assignee);
  });

  it("allows assignee to answer and PO to dismiss", async () => {
    const answerResponse = await POST(
      createRequest({
        entry_id: "entry-1",
        question_id: "question-1",
        answer: "Tied to PR-42",
        status: "ANSWERED",
      }),
      { params: Promise.resolve({ projectId }) } as any
    );

    expect(answerResponse.status).toBe(200);
    const answered = await answerResponse.json();
    expect(answered.clarification.status).toBe("ANSWERED");

    getUserFromRequest.mockResolvedValueOnce(po);
    const dismissResponse = await POST(
      createRequest({
        entry_id: "entry-1",
        question_id: "question-2",
        status: "DISMISSED",
        dismissed_until: "2024-01-02",
      }),
      { params: Promise.resolve({ projectId }) } as any
    );

    expect(dismissResponse.status).toBe(200);
    const dismissed = await dismissResponse.json();
    expect(dismissed.clarification.status).toBe("DISMISSED");
  });

  it("rejects non-assignee, non-admin users", async () => {
    getUserFromRequest.mockResolvedValueOnce(outsider);

    const response = await POST(
      createRequest({
        entry_id: "entry-1",
        question_id: "question-1",
        answer: "I should not be able to answer",
      }),
      { params: Promise.resolve({ projectId }) } as any
    );

    expect(response.status).toBe(403);
  });
});
