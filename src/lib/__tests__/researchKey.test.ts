import { describe, expect, it, vi } from "vitest";

import { getNextResearchKey } from "../researchKey";

const createMockPrisma = (keys: string[], projectName = "Demo Project") =>
  ({
    project: {
      findUnique: vi.fn().mockResolvedValue({ name: projectName }),
    },
    researchItem: {
      findMany: vi.fn().mockResolvedValue(keys.map((key) => ({ key }))),
    },
  }) as any;

describe("getNextResearchKey", () => {
  it("returns DP-1 when no research items exist", async () => {
    const prisma = createMockPrisma([]);

    await expect(getNextResearchKey(prisma, "project-1")).resolves.toBe("DP-1");
  });

  it("increments based on the highest existing numeric suffix", async () => {
    const prisma = createMockPrisma(["DP-1", "DP-5", "DP-3"]);

    await expect(getNextResearchKey(prisma, "project-1")).resolves.toBe("DP-6");
  });

  it("handles mixed-case prefixes", async () => {
    const prisma = createMockPrisma(["dp-2", "DP-10"]);

    await expect(getNextResearchKey(prisma, "project-1")).resolves.toBe("DP-11");
  });
});
