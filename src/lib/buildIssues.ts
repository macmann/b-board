import type { PrismaClient } from "@prisma/client";

export class IssueProjectMismatchError extends Error {
  constructor(message = "One or more issues do not belong to the project") {
    super(message);
    this.name = "IssueProjectMismatchError";
  }
}

export const dedupeIssueIds = (issueIds: string[]): string[] => {
  return [...new Set(issueIds)];
};

export const validateIssueIdsForProject = async (
  prismaClient: PrismaClient,
  projectId: string,
  issueIds: string[]
): Promise<string[]> => {
  const uniqueIssueIds = dedupeIssueIds(issueIds);

  if (!uniqueIssueIds.length) {
    return [];
  }

  const issues = await prismaClient.issue.findMany({
    where: { id: { in: uniqueIssueIds }, projectId },
    select: { id: true },
  });

  if (issues.length !== uniqueIssueIds.length) {
    throw new IssueProjectMismatchError();
  }

  return uniqueIssueIds;
};
