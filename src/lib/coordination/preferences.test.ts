import { describe, expect, it } from "vitest";

import { isWithinQuietHours, mapRuleToCategory, normalizePreferencesInput } from "./preferences";

describe("coordination preferences", () => {
  it("maps rule ids to categories", () => {
    expect(mapRuleToCategory("question-unanswered-24h")).toBe("QUESTIONS");
    expect(mapRuleToCategory("missing-standup-two-days")).toBe("STANDUPS");
    expect(mapRuleToCategory("action-overdue")).toBe("OVERDUE_ACTIONS");
    expect(mapRuleToCategory("blocker-persisted-high-severity")).toBe("BLOCKERS");
  });

  it("evaluates quiet-hours windows including overnight", () => {
    expect(
      isWithinQuietHours({
        when: new Date("2026-02-20T22:30:00.000Z"),
        quietHoursStart: 22,
        quietHoursEnd: 6,
        timezoneOffsetMinutes: 0,
      })
    ).toBe(true);
  });

  it("normalizes invalid preference input", () => {
    expect(
      normalizePreferencesInput({
        quietHoursStart: 90,
        quietHoursEnd: -2,
        timezoneOffsetMinutes: 2000,
        maxNudgesPerDay: 0,
        channels: [],
      })
    ).toMatchObject({
      quietHoursStart: null,
      quietHoursEnd: null,
      timezoneOffsetMinutes: 840,
      maxNudgesPerDay: 1,
      channels: ["IN_APP"],
    });
  });
});
