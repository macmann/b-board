import { IssueStatus } from "@prisma/client";

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
