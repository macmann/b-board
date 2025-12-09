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
  const issueId = await resolveIssueId(params);

  if (!issueId) {
    notFound();
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { projectId: true },
  });

  const context = issue
    ? await getCurrentProjectContext(issue.projectId)
    : { membership: null, user: null, project: null };

  const projectRole = mapRole(
    (context.membership?.role as ProjectRole | null) ?? null,
    context.user?.role ?? null
  );

  return (
    <IssueDetailsPageClient
      issueId={issueId}
      projectRole={projectRole}
      currentUserId={context.user?.id ?? null}
    />
  );
}
