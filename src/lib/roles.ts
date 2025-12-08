export type GlobalRole = "ADMIN" | "MEMBER";
export type ProjectRole = "ADMIN" | "PO" | "DEV" | "QA" | "VIEWER";

export const PROJECT_ADMIN_ROLES: ProjectRole[] = ["ADMIN", "PO"];
export const PROJECT_CONTRIBUTOR_ROLES: ProjectRole[] = [
  "ADMIN",
  "PO",
  "DEV",
  "QA",
];
export const PROJECT_VIEWER_ROLES: ProjectRole[] = [
  "ADMIN",
  "PO",
  "DEV",
  "QA",
  "VIEWER",
];
