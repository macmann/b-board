import {
  type DailyStandupEntry,
  type Issue,
  type ProjectMember,
  type ResearchItem,
  type User,
} from "@prisma/client";
import { vi } from "vitest";

type StandupIssueLink = {
  standupEntryId: string;
  issueId: string;
  issue: Issue;
};

type StandupResearchLink = {
  standupEntryId: string;
  researchItemId: string;
  researchItem: ResearchItem;
};

type StandupRecord = DailyStandupEntry & { issues: StandupIssueLink[]; research: StandupResearchLink[] };
type StandupAttendanceRecord = {
  id: string;
  projectId: string;
  userId: string;
  date: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const toKey = (projectId: string, userId: string, date: Date) => {
  return `${projectId}|${userId}|${date.toISOString()}`;
};

export class FakePrismaClient {
  standupEntries = new Map<string, StandupRecord>();
  standupAttendances = new Map<string, StandupAttendanceRecord>();
  issues = new Map<string, Issue>();
  researchItems = new Map<string, ResearchItem>();
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
          research: [],
        };
      this.standupEntries.set(key, created);
      return created;
    }),

    findUnique: vi.fn(async ({ where, include }: any): Promise<StandupRecord | null> => {
      if (where.id) {
        for (const record of this.standupEntries.values()) {
          if (record.id === where.id) {
            return this.includeLinkedWork(record, include);
          }
        }
        return null;
      }

      const { projectId, userId, date } = where.projectId_userId_date;
      const key = toKey(projectId, userId, new Date(date));
      const record = this.standupEntries.get(key);
      return record ? this.includeLinkedWork(record, include) : null;
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

        matches.push(this.includeLinkedWork(record, include));
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

  standupEntryResearchLink = {
    deleteMany: vi.fn(async ({ where }: any) => {
      let removed = 0;
      for (const record of this.standupEntries.values()) {
        if (where.standupEntryId && record.id !== where.standupEntryId) continue;

        if (where.researchItemId?.notIn) {
          const initialLength = record.research.length;
          record.research = record.research.filter((link) => where.researchItemId.notIn.includes(link.researchItemId));
          removed += initialLength - record.research.length;
        } else if (where.researchItemId) {
          const initialLength = record.research.length;
          record.research = record.research.filter((link) => link.researchItemId !== where.researchItemId);
          removed += initialLength - record.research.length;
        } else {
          removed += record.research.length;
          record.research = [];
        }
      }
      return { count: removed };
    }),

    createMany: vi.fn(async ({ data, skipDuplicates }: any) => {
      let created = 0;
      for (const item of data) {
        const entry = this.findEntryById(item.standupEntryId);
        if (!entry) continue;

        const exists = entry.research.some((link) => link.researchItemId === item.researchItemId);
        if (exists && skipDuplicates) continue;

        const researchItem = this.researchItems.get(item.researchItemId);
        if (!researchItem) continue;

        entry.research.push({
          standupEntryId: entry.id,
          researchItemId: researchItem.id,
          researchItem,
        });
        created++;
      }

      return { count: created };
    }),
  };

  standupAttendance = {
    upsert: vi.fn(async ({ where, create, update }: any) => {
      const { projectId, userId, date } = where.projectId_userId_date;
      const key = toKey(projectId, userId, new Date(date));
      const existing = this.standupAttendances.get(key);

      if (existing) {
        const next = { ...existing, ...update, updatedAt: new Date() };
        this.standupAttendances.set(key, next);
        return next;
      }

      const created = {
        ...create,
        id: create.id ?? `attendance-${this.standupAttendances.size + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.standupAttendances.set(key, created);
      return created;
    }),

    findMany: vi.fn(async ({ where, select }: any) => {
      const matches: any[] = [];

      for (const record of this.standupAttendances.values()) {
        if (where.projectId && record.projectId !== where.projectId) continue;
        if (where.userId && record.userId !== where.userId) continue;

        if (where.date) {
          const targetDate = new Date(where.date);
          if (record.date.toDateString() !== targetDate.toDateString()) continue;
        }

        if (select) {
          const selected: any = {};
          if (select.userId) selected.userId = record.userId;
          if (select.status) selected.status = record.status;
          matches.push(selected);
        } else {
          matches.push(record);
        }
      }

      return matches;
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

  researchItem = {
    findMany: vi.fn(async ({ where: { id, projectId } }: any) => {
      const ids = (id?.in as string[]) ?? [];
      const matches: ResearchItem[] = [];
      for (const target of ids) {
        const researchItem = this.researchItems.get(target);
        if (researchItem && researchItem.projectId === projectId) {
          matches.push(researchItem);
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
      { ...entry, issues: entry.issues ?? [], research: entry.research ?? [] }
    );
  }

  private findEntryById(id: string): StandupRecord | undefined {
    for (const entry of this.standupEntries.values()) {
      if (entry.id === id) return entry;
    }
    return undefined;
  }

  private includeLinkedWork(record: StandupRecord, include?: any): StandupRecord {
    const next: StandupRecord = { ...record } as StandupRecord;

    if (include?.issues) {
      const issues = record.issues ?? [];
      next.issues = issues.map((link) => ({ ...link, issue: link.issue }));
    }

    if (include?.research) {
      const research = record.research ?? [];
      next.research = research.map((link) => ({ ...link, researchItem: link.researchItem }));
    }

    return next;
  }
}
