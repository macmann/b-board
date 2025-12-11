import type { PrismaClient } from "@prisma/client";

const RESEARCH_KEY_PREFIX = "DR";

export async function getNextResearchKey(
  prisma: PrismaClient,
  projectId: string
): Promise<string> {
  const existingKeys = await prisma.researchItem.findMany({
    where: { projectId },
    select: { key: true },
  });

  const nextNumber = existingKeys.reduce((max, { key }) => {
    const match = key.match(/^(?:DR|dr)-(\d+)$/i);
    const value = match ? Number.parseInt(match[1], 10) : Number.NEGATIVE_INFINITY;
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);

  return `${RESEARCH_KEY_PREFIX}-${nextNumber + 1}`;
}
