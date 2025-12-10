import prisma from "./db";
import { ResearchStatus } from "./prismaEnums";

export async function getNextResearchPosition(
  projectId: string,
  status: ResearchStatus
) {
  const result = await prisma.researchItem.aggregate({
    where: { projectId, status },
    _max: { position: true },
  });

  const currentMax = result._max.position ?? -1;

  return currentMax + 1;
}

export function recalculateResearchPositions(
  items: Array<{ id: string }>,
  step: number = 1,
  start: number = 0
) {
  return items.map((item, index) => ({
    id: item.id,
    position: start + index * step,
  }));
}
