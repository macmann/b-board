import { Role, type DailyStandupEntry, type Issue, type ProjectMember, type StandupEntryIssueLink, type User } from "@prisma/client";

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

export const buildUser = (overrides: Partial<User> = {}): User => ({
  id: overrides.id ?? nextId("user"),
  name: overrides.name ?? "Test User",
  email: overrides.email ?? `${nextId("user")}@example.com`,
  passwordHash: overrides.passwordHash ?? "hashed-password",
  avatarUrl: overrides.avatarUrl ?? null,
  role: overrides.role ?? Role.DEV,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

export const buildProjectMember = (overrides: Partial<ProjectMember> = {}): ProjectMember => ({
  id: overrides.id ?? nextId("member"),
  projectId: overrides.projectId ?? nextId("project"),
  userId: overrides.userId ?? nextId("user"),
  role: overrides.role ?? Role.DEV,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

export const buildIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: overrides.id ?? nextId("issue"),
  projectId: overrides.projectId ?? nextId("project"),
  title: overrides.title ?? "Sample issue",
  description: overrides.description ?? "",
  type: overrides.type ?? "STORY",
  status: overrides.status ?? "TODO",
  priority: overrides.priority ?? "MEDIUM",
  reporterId: overrides.reporterId ?? nextId("user"),
  assigneeId: overrides.assigneeId ?? null,
  sprintId: overrides.sprintId ?? null,
  storyPoints: overrides.storyPoints ?? null,
  epicId: overrides.epicId ?? null,
  rank: overrides.rank ?? null,
  dueDate: overrides.dueDate ?? null,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

export const buildStandupEntry = (
  overrides: Partial<DailyStandupEntry> = {}
): DailyStandupEntry => ({
  id: overrides.id ?? nextId("standup"),
  projectId: overrides.projectId ?? nextId("project"),
  userId: overrides.userId ?? nextId("user"),
  date: overrides.date ?? new Date("2024-01-01"),
  summaryToday: overrides.summaryToday ?? null,
  progressSinceYesterday: overrides.progressSinceYesterday ?? null,
  blockers: overrides.blockers ?? null,
  dependencies: overrides.dependencies ?? null,
  notes: overrides.notes ?? null,
  isComplete: overrides.isComplete ?? false,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
});

export const buildStandupIssueLink = (
  overrides: Partial<StandupEntryIssueLink> = {}
): StandupEntryIssueLink => ({
  id: overrides.id ?? nextId("standup-link"),
  standupEntryId: overrides.standupEntryId ?? nextId("standup"),
  issueId: overrides.issueId ?? nextId("issue"),
  createdAt: overrides.createdAt ?? new Date(),
});
