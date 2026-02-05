import { PROJECT_ADMIN_ROLES, ProjectRole } from "./roles";

type IssueIdentifiers = {
  assigneeId: string | null;
  secondaryAssigneeId: string | null;
  reporterId: string | null;
};

export const canManageSprints = (role: ProjectRole | null | undefined): boolean => {
  return role === "ADMIN" || role === "PO";
};

export const canInviteMembers = (role: ProjectRole | null | undefined): boolean => {
  return role === "ADMIN" || role === "PO";
};

export const canDeleteIssue = (role: ProjectRole | null | undefined): boolean => {
  if (!role) return false;

  return PROJECT_ADMIN_ROLES.includes(role);
};

export const canEditIssue = (
  role: ProjectRole | null | undefined,
  issue: IssueIdentifiers | null,
  currentUserId: string | null
): boolean => {
  if (!role || !issue || !currentUserId) return false;

  if (role === "ADMIN" || role === "PO") return true;
  if (role === "VIEWER") return false;

  const isAssigneeOrReporter =
    issue.assigneeId === currentUserId ||
    issue.secondaryAssigneeId === currentUserId ||
    issue.reporterId === currentUserId;

  return (role === "DEV" || role === "QA") && isAssigneeOrReporter;
};
