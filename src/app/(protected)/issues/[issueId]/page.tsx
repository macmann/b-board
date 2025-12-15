import { notFound } from "next/navigation";

import prisma from "../../../../lib/db";
import { getCurrentProjectContext } from "../../../../lib/projectContext";
import { UserRole } from "../../../../lib/prismaEnums";
import { ProjectRole } from "../../../../lib/roles";
import IssueDetailsPageClient from "./pageClient";

type IssueParams = Promise<{ issueId?: string }> | { issueId?: string } | undefined;

const resolveIssueId = async (params: IssueParams): Promise<string | null> => {
  const resolvedParams = params && "then" in params ? await params : params;

  if (!resolvedParams || typeof resolvedParams !== "object") {
    return null;
  }

  if (!("issueId" in resolvedParams)) {
    return null;
  }

  const { issueId } = resolvedParams as { issueId?: string };
  return issueId ?? null;
};

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

type Props = {
  params: IssueParams;
};

export default async function IssueDetailsPage({ params }: Props) {
  const issueIdentifier = await resolveIssueId(params);

  if (!issueIdentifier) {
    notFound();
  }

  const issue = await prisma.issue.findFirst({
    where: { OR: [{ id: issueIdentifier }, { key: issueIdentifier }] },
    select: { id: true, projectId: true },
  });

  if (!issue) {
    notFound();
  }

  const context = await getCurrentProjectContext(issue.projectId);

  const projectRole = mapRole(
    (context.membership?.role as ProjectRole | null) ?? null,
    context.user?.role ?? null
  );

  const sprints = await prisma.sprint.findMany({
    where: { projectId: issue.projectId },
    select: { id: true, name: true, status: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <IssueDetailsPageClient
      issueId={issue.id}
      projectRole={projectRole}
      currentUserId={context.user?.id ?? null}
      initialSprints={sprints}
    />
  );
}
