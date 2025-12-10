import { type DailyStandupEntry, type Issue, type ProjectMember, type User } from "@prisma/client";
import { vi } from "vitest";

type StandupIssueLink = {
  standupEntryId: string;
  issueId: string;
  issue: Issue;
};

type StandupRecord = DailyStandupEntry & { issues: StandupIssueLink[] };

const toKey = (projectId: string, userId: string, date: Date) => {
  return `${projectId}|${userId}|${date.toISOString()}`;
};

export class FakePrismaClient {
  standupEntries = new Map<string, StandupRecord>();
  issues = new Map<string, Issue>();
  users = new Map<string, User>();
  projectMembers: ProjectMember[] = [];

  dailyStandupEntry = {
    upsert: vi.fn(async ({ where, create, update }: any): Promise<DailyStandupEntry> => {
      const { projectId, userId, date } = where.projectId_userId_date;
      const key = toKey(projectId, userId, new Date(date));
      const existing = this.standupEntries.get(key);

      if (existing) {
        const updated: StandupRecord = {
          ...existing,
          ...update,
          updatedAt: new Date(),
        };
        this.standupEntries.set(key, updated);
        return updated;
      }

      const created: StandupRecord = {
        ...create,
        id: create.id ?? `standup-${this.standupEntries.size + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        issues: [],
      };
      this.standupEntries.set(key, created);
      return created;
    }),

    findUnique: vi.fn(async ({ where, include }: any): Promise<StandupRecord | null> => {
      if (where.id) {
        for (const record of this.standupEntries.values()) {
          if (record.id === where.id) {
            return this.includeIssues(record, include);
          }
        }
        return null;
      }

      const { projectId, userId, date } = where.projectId_userId_date;
      const key = toKey(projectId, userId, new Date(date));
      const record = this.standupEntries.get(key);
      return record ? this.includeIssues(record, include) : null;
    }),

    findMany: vi.fn(async ({ where, orderBy, include }: any): Promise<StandupRecord[]> => {
      const matches: StandupRecord[] = [];
      for (const record of this.standupEntries.values()) {
        if (where.projectId && record.projectId !== where.projectId) continue;
        if (where.userId && record.userId !== where.userId) continue;

        if (where.date) {
          const dateFilter = where.date;
          const recordDate = record.date;
          if (dateFilter instanceof Date) {
            if (recordDate.toDateString() !== dateFilter.toDateString()) continue;
          } else {
            if (dateFilter.gte && recordDate < new Date(dateFilter.gte)) continue;
            if (dateFilter.lte && recordDate > new Date(dateFilter.lte)) continue;
          }
        }

        matches.push(this.includeIssues(record, include));
      }

      if (orderBy?.updatedAt === "desc") {
        matches.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      }

      if (orderBy?.date === "desc") {
        matches.sort((a, b) => b.date.getTime() - a.date.getTime());
      }

      return matches;
    }),
  };

  standupEntryIssueLink = {
    deleteMany: vi.fn(async ({ where }: any) => {
      let removed = 0;
      for (const record of this.standupEntries.values()) {
        if (where.standupEntryId && record.id !== where.standupEntryId) continue;

        if (where.issueId?.notIn) {
          const initialLength = record.issues.length;
          record.issues = record.issues.filter((link) => where.issueId.notIn.includes(link.issueId));
          removed += initialLength - record.issues.length;
        } else if (where.issueId) {
          const initialLength = record.issues.length;
          record.issues = record.issues.filter((link) => link.issueId !== where.issueId);
          removed += initialLength - record.issues.length;
        } else {
          removed += record.issues.length;
          record.issues = [];
        }
      }
      return { count: removed };
    }),

    createMany: vi.fn(async ({ data, skipDuplicates }: any) => {
      let created = 0;
      for (const item of data) {
        const entry = this.findEntryById(item.standupEntryId);
        if (!entry) continue;

        const exists = entry.issues.some((link) => link.issueId === item.issueId);
        if (exists && skipDuplicates) continue;

        const issue = this.issues.get(item.issueId);
        if (!issue) continue;

        entry.issues.push({ standupEntryId: entry.id, issueId: issue.id, issue });
        created++;
      }

      return { count: created };
    }),
  };

  issue = {
    findMany: vi.fn(async ({ where: { id, projectId } }: any) => {
      const ids = (id?.in as string[]) ?? [];
      const matches: Issue[] = [];
      for (const target of ids) {
        const issue = this.issues.get(target);
        if (issue && issue.projectId === projectId) {
          matches.push(issue);
        }
      }
      return matches;
    }),
  };

  projectMember = {
    findMany: vi.fn(async ({ where: { projectId }, include }: any) => {
      return this.projectMembers
        .filter((member) => member.projectId === projectId)
        .map((member) =>
          include?.user
            ? {
                ...member,
                user: this.users.get(member.userId) ?? {
                  id: member.userId,
                  name: "Unknown User",
                  email: `${member.userId}@example.com`,
                  passwordHash: "",
                  avatarUrl: null,
                  role: member.role,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              }
            : member
        );
    }),
    findUnique: vi.fn(async ({ where: { projectId_userId } }: any) => {
      return (
        this.projectMembers.find(
          (member) =>
            member.projectId === projectId_userId.projectId && member.userId === projectId_userId.userId
        ) ?? null
      );
    }),
  };

  user = {
    findUnique: vi.fn(async ({ where: { id } }: any) => {
      return this.users.get(id) ?? null;
    }),
  };

  $transaction = vi.fn(async (callback: any) => callback(this));

  addEntry(entry: StandupRecord) {
    this.standupEntries.set(
      toKey(entry.projectId, entry.userId, entry.date),
      { ...entry, issues: entry.issues ?? [] }
    );
  }

  private findEntryById(id: string): StandupRecord | undefined {
    for (const entry of this.standupEntries.values()) {
      if (entry.id === id) return entry;
    }
    return undefined;
  }

  private includeIssues(record: StandupRecord, include?: any): StandupRecord {
    if (!include?.issues) return record;
    const issues = record.issues ?? [];
    return { ...record, issues: issues.map((link) => ({ ...link, issue: link.issue })) };
  }
}
