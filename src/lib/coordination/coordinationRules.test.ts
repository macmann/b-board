import { describe, expect, it } from "vitest";

import { buildTriggerDedupKey, evaluateCoordinationRules } from "./coordinationRules";
import type { CoordinationEvent } from "./types";

const baseEvent: CoordinationEvent = {
  id: "evt-1",
  projectId: "project-1",
  eventType: "BLOCKER_PERSISTED",
  targetUserId: "user-1",
  relatedEntityId: "issue-1",
  severity: "HIGH",
  metadata: { blockerDays: 2 },
  occurredAt: new Date("2026-02-16T00:00:00.000Z"),
};

describe("evaluateCoordinationRules", () => {
  it("creates a level-1 nudge trigger for persistent high severity blockers", () => {
    const drafts = evaluateCoordinationRules({ event: baseEvent, now: new Date("2026-02-16T12:00:00.000Z") });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      ruleId: "blocker-persisted-high-severity",
      targetUserId: "user-1",
      escalationLevel: 1,
      dedupKey: "blocker-persisted-high-severity:user-1:issue-1:L1",
    });
  });

  it("escalates blocker target to dependency owner on day 3", () => {
    const drafts = evaluateCoordinationRules({
      event: {
        ...baseEvent,
        metadata: { blockerDays: 3, dependencyOwnerUserId: "dep-owner" },
      },
      now: new Date("2026-02-17T12:00:00.000Z"),
    });

    expect(drafts[0]).toMatchObject({ targetUserId: "dep-owner", escalationLevel: 2 });
  });

  it("creates question reminder escalation at 72h and targets PO", () => {
    const drafts = evaluateCoordinationRules({
      event: {
        ...baseEvent,
        eventType: "QUESTION_UNANSWERED",
        targetUserId: "assignee",
        metadata: { unansweredHours: 72, poUserId: "po-1" },
      },
      now: new Date("2026-02-16T12:00:00.000Z"),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      ruleId: "question-unanswered-24h",
      targetUserId: "po-1",
      escalationLevel: 3,
      dedupKey: "question-unanswered-24h:po-1:issue-1:L3",
    });
  });

  it("builds dedup key with escalation level", () => {
    expect(buildTriggerDedupKey("r", "u", "e", 2)).toBe("r:u:e:L2");
  });
});
