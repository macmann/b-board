import { describe, expect, it } from "vitest";

import {
  normalizeSummaryBulletIds,
  type StandupSummaryV1,
} from "./standupSummary";

const baseSummary = (): StandupSummaryV1 => ({
  summary_id: "project-1:2026-02-13",
  project_id: "project-1",
  date: "2026-02-13",
  overall_progress: "Progress looks good.",
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
