export const Role = {
  ADMIN: "ADMIN",
  PO: "PO",
  DEV: "DEV",
  QA: "QA",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const UserRole = Role;
export type UserRole = Role;

export const SprintStatus = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
} as const;

export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

export const WorkspaceMemberRole = {
  OWNER: "OWNER",
  MEMBER: "MEMBER",
} as const;

export type WorkspaceMemberRole =
  (typeof WorkspaceMemberRole)[keyof typeof WorkspaceMemberRole];

export const EpicStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
} as const;

export type EpicStatus = (typeof EpicStatus)[keyof typeof EpicStatus];

export const IssueType = {
  STORY: "STORY",
  BUG: "BUG",
  TASK: "TASK",
} as const;

export type IssueType = (typeof IssueType)[keyof typeof IssueType];

export const IssueStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  DONE: "DONE",
} as const;

export type IssueStatus = (typeof IssueStatus)[keyof typeof IssueStatus];

export const IssuePriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type IssuePriority = (typeof IssuePriority)[keyof typeof IssuePriority];

export const IssueHistoryField = {
  STATUS: "STATUS",
  ASSIGNEE: "ASSIGNEE",
  STORY_POINTS: "STORY_POINTS",
  SPRINT: "SPRINT",
  TYPE: "TYPE",
  PRIORITY: "PRIORITY",
  EPIC: "EPIC",
} as const;

export type IssueHistoryField =
  (typeof IssueHistoryField)[keyof typeof IssueHistoryField];

export const ProjectMemberRole = Role;
export type ProjectMemberRole = Role;

export const ResearchStatus = {
  BACKLOG: "BACKLOG",
  IN_PROGRESS: "IN_PROGRESS",
  REVIEW: "REVIEW",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;

export type ResearchStatus = (typeof ResearchStatus)[keyof typeof ResearchStatus];

export const EmailProviderType = {
  SMTP: "SMTP",
  API: "API",
  MS365: "MS365",
  GOOGLE_MAIL: "GOOGLE_MAIL",
} as const;

export type EmailProviderType =
  (typeof EmailProviderType)[keyof typeof EmailProviderType];
