import { UserRole } from "@prisma/client";

import prisma from "../../../../lib/db";
import { getCurrentProjectContext } from "../../../../lib/projectContext";
import { ProjectRole } from "../../../../lib/roles";
import IssueDetailsPageClient from "./pageClient";

const mapRole = (
  membershipRole: ProjectRole | null,
  userRole: UserRole | null
): ProjectRole | null => {
  if (userRole === UserRole.ADMIN) return "ADMIN";
  return membershipRole;
};

export default async function IssueDetailsPage({
  params,
}: {
  params: { issueId: string };
}) {
  const issue = await prisma.issue.findUnique({
    where: { id: params.issueId },
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
      issueId={params.issueId}
      projectRole={projectRole}
      currentUserId={context.user?.id ?? null}
    />
  );
}
