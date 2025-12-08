import { IssueStatus } from "./prismaEnums";

import prisma from "./db";

export async function getNextIssuePosition(
  projectId: string,
  sprintId: string,
  status: IssueStatus
) {
  const result = await prisma.issue.aggregate({
    where: { projectId, sprintId, status },
    _max: { position: true },
  });

  const currentMax = result._max.position ?? 0;

  return currentMax + 1;
}

export function recalculatePositions(
  issues: Array<{ id: string }>,
  step: number = 1,
  start: number = 1
) {
  return issues.map((issue, index) => ({
    id: issue.id,
    position: start + index * step,
  }));
}
