import { describe, expect, it } from "vitest";

import { calculateNudgeQualityMetrics, maybeAdjustSeverityForDismissalRate } from "./nudgeQuality";

describe("nudgeQuality", () => {
  it("calculates rates", () => {
    expect(calculateNudgeQualityMetrics({ resolvedCount: 6, dismissedCount: 4 })).toEqual({
      resolvedRate: 0.6,
      dismissedRate: 0.4,
    });
  });

  it("reduces severity when dismissal rate exceeds threshold", () => {
    expect(
      maybeAdjustSeverityForDismissalRate({ severity: "HIGH", dismissedRate: 0.7, dismissalRateThreshold: 0.45 })
    ).toBe("MEDIUM");
  });
});
