import { describe, expect, it } from "vitest";

import { renderDigest, type DigestSource } from "./standupDigest";

const source: DigestSource = {
  date: "2026-02-16",
  generated_at: "2026-02-16T09:12:00.000Z",
  summary_json: {
    overall_progress:
      "Team completed core API integration and validated smoke tests across service boundaries.",
    achievements: [
      {
        id: "a-3",
        text: "Zebra migration delivered",
        linked_work_ids: ["BB-30"],
      },
      {
        id: "a-1",
        text: "Alpha endpoint stabilized",
        linked_work_ids: ["BB-10"],
      },
      {
        id: "a-2",
        text: "Beta caching tuned",
        linked_work_ids: ["BB-20"],
      },
      {
        id: "a-4",
        text: "Zulu extra win should not appear in stakeholder digest",
        linked_work_ids: ["BB-40"],
      },
    ],
    blockers: [
      {
        id: "b-2",
        text: "Medium risk around canary rollback",
        linked_work_ids: ["OPS-6"],
      },
      {
        id: "b-1",
        text: "Critical vendor firewall delay",
        linked_work_ids: ["OPS-1"],
      },
      {
        id: "b-3",
        text: "Third risk line for cap checks",
        linked_work_ids: ["OPS-7"],
      },
      {
        id: "b-4",
        text: "Zulu risk should be trimmed for stakeholder output",
        linked_work_ids: ["OPS-8"],
      },
    ],
    dependencies: [],
    assignment_gaps: [],
    actions_required: [
      {
        id: "ac-2",
        title: "Schedule rollback drill",
        reason: "Canary rollback confidence is low",
        linked_work_ids: ["OPS-6"],
        severity: "med",
        due: "2026-02-18",
      },
      {
        id: "ac-1",
        title: "Escalate vendor firewall decision immediately with an intentionally long title that should be truncated in compact mode",
        reason: "Traffic still blocked from staging environment",
        linked_work_ids: ["OPS-1"],
        severity: "high",
        due: "2026-02-17",
      },
      {
        id: "ac-3",
        title: "Confirm owner for follow-up",
        reason: "Owner unclear",
        linked_work_ids: ["OPS-2"],
        severity: "low",
        due: "2026-02-20",
      },
      {
        id: "ac-4",
        title: "Fourth action should be hidden in stakeholder digest",
        reason: "Cap guardrail",
        linked_work_ids: ["OPS-9"],
        severity: "low",
        due: "2026-02-22",
      },
    ],
    open_questions: [
      {
        id: "q-2",
        question_text: "Can Ops approve emergency exception?",
        source_entry_ids: ["e-2"],
        priority: "high",
      },
      {
        id: "q-1",
        question_text: "Who owns post-deploy verification?",
        source_entry_ids: ["e-1"],
        priority: "med",
      },
    ],
  },
  summary_rendered: {
    overall_progress:
      "Team completed core API integration and validated smoke tests across service boundaries.",
  },
  signals: {
    quality_score: 88,
    metrics: {
      completion_rate: 0.75,
      missing_linked_work_rate: 0.2,
      missing_blockers_rate: 0.1,
      vague_update_rate: 0,
    },
  },
};

describe("renderDigest", () => {
  it("enforces stakeholder guardrails and deterministic order", () => {
    const digest = renderDigest("stakeholder", source, { includeReferences: true });
    const lines = digest.split("\n");

    expect(lines.length).toBeLessThanOrEqual(8);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Stakeholder Digest — As of 2026-02-16");
    expect(lines[2]).toContain("Alpha endpoint stabilized");
    expect(lines[2]).not.toContain("Zulu extra win should not appear");
    expect(lines[3]).not.toContain("Zulu risk should be trimmed");
    expect(lines[4]).toContain("Escalate vendor firewall decision");
    expect(lines[4]).not.toContain("Fourth action should be hidden");
    expect(lines.every((line) => line.length <= 160)).toBe(true);
  });

  it("renders detailed digest with fixed section order", () => {
    const digest = renderDigest("team-detailed", source, {
      includeReferences: true,
    });

    const actionCenterIndex = digest.indexOf("Action Center");
    const openQuestionsIndex = digest.indexOf("Open Questions");
    const signalsIndex = digest.indexOf("Signals");
    const fullSummaryIndex = digest.indexOf("Full Summary");

    expect(actionCenterIndex).toBeGreaterThan(-1);
    expect(openQuestionsIndex).toBeGreaterThan(actionCenterIndex);
    expect(signalsIndex).toBeGreaterThan(openQuestionsIndex);
    expect(fullSummaryIndex).toBeGreaterThan(signalsIndex);
    expect(digest).toContain("refs: OPS-1");
  });

  it("renders sprint snapshot with explicit time context", () => {
    const digest = renderDigest("sprint-snapshot", source);

    expect(digest).toContain("# Sprint Snapshot — Week of 2026-02-16");
    expect(digest).toContain("Generated on 2026-02-16 09:12 UTC");
    expect(digest).toContain("## Progress");
    expect(digest).toContain("## Wins");
    expect(digest).toContain("## Risks / Blockers");
    expect(digest).toContain("## Actions Needed");
  });

  it("normalizes copy formatting for paste targets", () => {
    const digest = renderDigest("team-detailed", {
      ...source,
      summary_json: {
        ...source.summary_json!,
        achievements: [{ id: "x", text: "Done   with   extra   spaces", linked_work_ids: [] }],
      },
    });

    expect(digest).not.toMatch(/\n{3,}/);
    expect(digest.split("\n").every((line) => !/\s+$/.test(line))).toBe(true);
    expect(digest).toContain("Done with extra spaces");
  });
});
