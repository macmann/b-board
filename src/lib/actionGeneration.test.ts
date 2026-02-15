import { describe, expect, it } from "vitest";

import { generateActionsRequired, normalizeActionItems } from "./actionGeneration";
import type { StandupSummaryV1 } from "./standupSummary";

const summary: StandupSummaryV1 = {
  summary_id: "project-1:2026-02-15",
  project_id: "project-1",
  date: "2026-02-15",
  overall_progress: "In progress",
  actions_required: [],
  achievements: [],
  blockers: [
    {
      id: "block-1",
      text: "Dev A: Need PO approval to proceed with billing API rollout.",
      source_entry_ids: ["entry-1"],
      linked_work_ids: ["ISS-1"],
    },
    {
      id: "block-2",
      text: "Dev B: Need PO approval to proceed with billing API rollout.",
      source_entry_ids: ["entry-3"],
      linked_work_ids: ["ISS-1"],
    },
  ],
  dependencies: [
    {
      id: "dep-1",
      text: "Waiting on infra team to provide database credentials.",
      source_entry_ids: ["entry-2"],
      linked_work_ids: ["ISS-2"],
    },
  ],
  assignment_gaps: [
    {
      id: "gap-1",
      text: "No owner for release checklist.",
      source_entry_ids: ["entry-2"],
      linked_work_ids: [],
    },
  ],
};

const entries: any[] = [
  {
    id: "entry-1",
    userId: "user-dev-1",
    date: new Date("2026-02-15"),
    projectId: "project-1",
    summaryToday: "",
    progressSinceYesterday: "",
    blockers: "Need PO approval",
    dependencies: null,
    notes: null,
    isComplete: false,
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-02-15"),
    user: { id: "user-dev-1", name: "Pat", email: "pat@example.com", role: "DEV" },
    issues: [
      {
        issue: {
          id: "issue-1",
          key: "ISS-1",
          assigneeId: "owner-1",
        },
      },
    ],
    research: [],
  },
  {
    id: "entry-2",
    userId: "user-dev-2",
    date: new Date("2026-02-15"),
    projectId: "project-1",
    summaryToday: "Need help",
    progressSinceYesterday: "started",
    blockers: null,
    dependencies: "waiting on infra",
    notes: null,
    isComplete: true,
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-02-15"),
    user: { id: "user-dev-2", name: "Dev", email: "dev@example.com", role: "DEV" },
    issues: [
      {
        issue: {
          id: "issue-2",
          key: "ISS-2",
          assigneeId: "owner-2",
        },
      },
    ],
    research: [],
  },
  {
    id: "entry-3",
    userId: "user-po",
    date: new Date("2026-02-15"),
    projectId: "project-1",
    summaryToday: "",
    progressSinceYesterday: "",
    blockers: "Need PO approval",
    dependencies: null,
    notes: null,
    isComplete: false,
    createdAt: new Date("2026-02-15"),
    updatedAt: new Date("2026-02-15"),
    user: { id: "user-po", name: "PO", email: "po@example.com", role: "PO" },
    issues: [],
    research: [],
  },
];

describe("generateActionsRequired", () => {
  it("deduplicates repeated blockers and ranks high severity first", () => {
    const first = generateActionsRequired(summary, entries as any);
    const second = generateActionsRequired(summary, entries as any);

    expect(first.length).toBeGreaterThanOrEqual(3);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));

    const approvalActions = first.filter((item) => item.reason.includes("approval"));
    expect(approvalActions).toHaveLength(1);
    expect(first[0].severity).toBe("high");
  });

  it("applies role-aware ownership for decision actions", () => {
    const actions = generateActionsRequired(summary, entries as any);
    const decisionAction = actions.find((item) => item.action_type === "UNBLOCK_DECISION");

    expect(decisionAction).toBeTruthy();
    expect(decisionAction?.owner_user_id).toBe("user-po");
  });

  it("normalizes provided actions with stable ids", () => {
    const normalized = normalizeActionItems(summary.summary_id, [
      {
        id: "x",
        title: "  Follow up now  ",
        owner_user_id: "owner-1",
        target_user_id: null,
        action_type: "FOLLOW_UP_STATUS",
        reason: "  waiting status  ",
        due: "today",
        severity: "med",
        source_entry_ids: ["entry-2", "entry-2"],
        linked_work_ids: ["ISS-2"],
      },
    ]);

    expect(normalized[0].id).toMatch(/^action_[a-f0-9]{12}$/);
    expect(normalized[0].title).toBe("Follow up now");
    expect(normalized[0].source_entry_ids).toEqual(["entry-2"]);
  });
});
