import { describe, expect, it, vi } from "vitest";

import { getNextResearchKey } from "../researchKey";

const createMockPrisma = (keys: string[]) =>
  ({
    researchItem: {
      findMany: vi.fn().mockResolvedValue(keys.map((key) => ({ key }))),
    },
  }) as any;

describe("getNextResearchKey", () => {
  it("returns DR-1 when no research items exist", async () => {
    const prisma = createMockPrisma([]);

    await expect(getNextResearchKey(prisma, "project-1")).resolves.toBe("DR-1");
  });

  it("increments based on the highest existing numeric suffix", async () => {
    const prisma = createMockPrisma(["DR-1", "DR-5", "DR-3"]);

    await expect(getNextResearchKey(prisma, "project-1")).resolves.toBe("DR-6");
  });

  it("handles mixed-case prefixes", async () => {
    const prisma = createMockPrisma(["dr-2", "DR-10"]);

    await expect(getNextResearchKey(prisma, "project-1")).resolves.toBe("DR-11");
  });
});
