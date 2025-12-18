import { describe, expect, it, vi } from "vitest";

import {
  IssueProjectMismatchError,
  validateIssueIdsForProject,
} from "./buildIssues";

type PrismaMock = {
  issue: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const createPrismaMock = (existingIds: string[]): PrismaMock => ({
  issue: {
    findMany: vi.fn(async ({ where }: any) => {
      const ids: string[] = where.id?.in ?? [];
      return existingIds
        .filter((id) => ids.includes(id))
        .map((id) => ({ id }));
    }),
  },
});

describe("validateIssueIdsForProject", () => {
  it("deduplicates and validates issue IDs belonging to the project", async () => {
    const prisma = createPrismaMock(["one", "two"]);
    const result = await validateIssueIdsForProject(
      prisma as any,
      "project-1",
      ["one", "one", "two"]
    );

    expect(result).toEqual(["one", "two"]);
    expect(prisma.issue.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["one", "two"] }, projectId: "project-1" },
      select: { id: true },
    });
  });

  it("throws when any issue does not belong to the project", async () => {
    const prisma = createPrismaMock(["one"]);

    await expect(
      validateIssueIdsForProject(prisma as any, "project-1", ["one", "missing"])
    ).rejects.toBeInstanceOf(IssueProjectMismatchError);
  });
});
