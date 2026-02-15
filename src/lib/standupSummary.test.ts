import { describe, expect, it } from "vitest";

import {
  attachSummaryEvidence,
  normalizeSummaryBulletIds,
  generateOpenQuestions,
  type StandupSummaryV1,
} from "./standupSummary";

const baseSummary = (): StandupSummaryV1 => ({
  summary_id: "project-1:2026-02-13",
  project_id: "project-1",
  date: "2026-02-13",
  overall_progress: "Progress looks good.",
  actions_required: [],
  open_questions: [],
  achievements: [
    {
      id: "temp-1",
      text: "  Completed API integration  ",
      source_entry_ids: ["entry-2", "entry-1", "entry-2"],
      linked_work_ids: ["issue-9", "issue-1", "issue-9"],
    },
  ],
  blockers: [],
  dependencies: [],
  assignment_gaps: [],
});

describe("normalizeSummaryBulletIds", () => {
  it("generates deterministic bullet ids from normalized bullet content", () => {
    const first = normalizeSummaryBulletIds(baseSummary());

    const second = normalizeSummaryBulletIds({
      ...baseSummary(),
      achievements: [
        {
          id: "another-id",
          text: "Completed API integration",
          source_entry_ids: ["entry-1", "entry-2"],
          linked_work_ids: ["issue-1", "issue-9"],
        },
      ],
    });

    expect(first.achievements[0].id).toBe(second.achievements[0].id);
    expect(first.achievements[0].id).toMatch(/^achievements_[a-f0-9]{12}$/);
  });

  it("changes ids when section changes", () => {
    const summary = baseSummary();
    summary.blockers = [summary.achievements[0]];

    const normalized = normalizeSummaryBulletIds(summary);

    expect(normalized.achievements[0].id).not.toBe(normalized.blockers[0].id);
  });
});

describe("attachSummaryEvidence", () => {
  it("fills missing source ids from linked work ids", () => {
    const summary = baseSummary();
    summary.achievements = [
      {
        id: "bullet-1",
        text: "Completed API integration",
        source_entry_ids: [],
        linked_work_ids: ["ISS-1"],
      },
    ];

    const hydrated = attachSummaryEvidence(summary, [
      {
        id: "entry-1",
        userId: "member-1",
        date: new Date("2026-02-13"),
        projectId: "project-1",
        summaryToday: "Completed API integration",
        progressSinceYesterday: null,
        blockers: null,
        dependencies: null,
        notes: null,
        isComplete: true,
        createdAt: new Date("2026-02-13"),
        updatedAt: new Date("2026-02-13"),
        user: {
          id: "member-1",
          name: "Alice",
          email: "alice@example.com",
          passwordHash: "",
          avatarUrl: null,
          role: "DEV",
          createdAt: new Date("2026-02-13"),
          updatedAt: new Date("2026-02-13"),
        },
        issues: [
          {
            issue: {
              id: "issue-1",
              projectId: "project-1",
              sprintId: null,
              epicId: null,
              title: "API integration",
              status: "IN_PROGRESS",
              assigneeId: null,
              reporterId: "member-1",
              linkedResearchId: null,
              linkedTestCaseId: null,
              priority: "MEDIUM",
              dueDate: null,
              estimatedHours: null,
              actualHours: null,
              aiSummary: null,
              createdAt: new Date("2026-02-13"),
              updatedAt: new Date("2026-02-13"),
              sortOrder: 0,
              key: "ISS-1",
              deletedAt: null,
            },
          },
        ],
        research: [],
      } as any,
    ]);

    expect(hydrated.achievements[0].source_entry_ids).toEqual(["entry-1"]);
  });
});


describe("generateOpenQuestions", () => {
  it("creates deterministic questions for ambiguous updates", () => {
    const entry = {
      id: "entry-1",
      userId: "member-1",
      date: new Date("2026-02-13"),
      projectId: "project-1",
      summaryToday: "Continue task",
      progressSinceYesterday: "Working on X",
      blockers: "Waiting on API approval",
      dependencies: null,
      notes: null,
      isComplete: true,
      createdAt: new Date("2026-02-13"),
      updatedAt: new Date("2026-02-13"),
      user: {
        id: "member-1",
        name: "Alice",
        email: "alice@example.com",
        passwordHash: "",
        avatarUrl: null,
        role: "DEV",
        createdAt: new Date("2026-02-13"),
        updatedAt: new Date("2026-02-13"),
      },
      issues: [],
      research: [],
    } as any;

    const first = generateOpenQuestions([entry], "project-1:2026-02-13");
    const second = generateOpenQuestions([entry], "project-1:2026-02-13");

    expect(first.map((question) => question.category)).toEqual(
      expect.arrayContaining(["LINK_WORK", "DEPENDENCY_OWNER", "DEFINE_NEXT_STEP"])
    );
    expect(first.map((question) => question.id)).toEqual(second.map((question) => question.id));
  });

  it("caps questions per person and per project", () => {
    const buildEntry = (index: number) =>
      ({
        id: `entry-${index}`,
        userId: `member-${Math.floor(index / 10)}`,
        date: new Date("2026-02-13"),
        projectId: "project-1",
        summaryToday: "Continue task",
        progressSinceYesterday: "Working on X",
        blockers: "Waiting on infra",
        dependencies: null,
        notes: null,
        isComplete: true,
        createdAt: new Date("2026-02-13"),
        updatedAt: new Date("2026-02-13"),
        user: {
          id: `member-${Math.floor(index / 10)}`,
          name: "User",
          email: "user@example.com",
          passwordHash: "",
          avatarUrl: null,
          role: "DEV",
          createdAt: new Date("2026-02-13"),
          updatedAt: new Date("2026-02-13"),
        },
        issues: [],
        research: [],
      }) as any;

    const entries = Array.from({ length: 30 }, (_, index) => buildEntry(index));
    const questions = generateOpenQuestions(entries, "project-1:2026-02-13");

    expect(questions.length).toBeLessThanOrEqual(15);

    const countByUserId = questions.reduce<Record<string, number>>((acc, item) => {
      acc[item.ask_to_user_id] = (acc[item.ask_to_user_id] ?? 0) + 1;
      return acc;
    }, {});

    Object.values(countByUserId).forEach((count) => {
      expect(count).toBeLessThanOrEqual(5);
    });
  });
});
