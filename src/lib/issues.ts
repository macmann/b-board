import prisma from "./db";

const CUID_PATTERN = /^c[\w-]{24,}$/i;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const looksLikeIssueId = (value: string) => CUID_PATTERN.test(value) || UUID_PATTERN.test(value);

export const resolveIssueId = async (
  projectId: string,
  issueKeyOrId?: string | null
): Promise<string | null> => {
  if (!issueKeyOrId) return null;

  if (looksLikeIssueId(issueKeyOrId)) {
    return issueKeyOrId;
  }

  const issue = await prisma.issue.findFirst({
    where: { projectId, key: issueKeyOrId },
    select: { id: true },
  });

  return issue?.id ?? null;
};
