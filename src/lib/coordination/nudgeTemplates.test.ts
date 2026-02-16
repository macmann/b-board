import { describe, expect, it } from "vitest";

import { buildNudgeTemplate } from "./nudgeTemplates";

describe("buildNudgeTemplate", () => {
  it("builds deterministic blocker copy", () => {
    const result = buildNudgeTemplate({
      ruleId: "blocker-persisted-high-severity",
      escalationLevel: 1,
      blockerDays: 2,
      blockerReason: "waiting on API contract",
    });

    expect(result).toEqual({
      title: "Persistent blocker requires action",
      body: "Your task is blocked for 2 days due to waiting on API contract. Do you still need assistance?",
    });
  });

  it("adds escalation suffix", () => {
    const result = buildNudgeTemplate({
      ruleId: "missing-standup-two-days",
      escalationLevel: 3,
      missingStandupDays: 4,
    });

    expect(result.body).toContain("Escalation level: L3.");
  });
});
