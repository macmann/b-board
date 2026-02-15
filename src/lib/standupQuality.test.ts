import { describe, expect, it } from "vitest";

import { calculateStandupQuality } from "./standupQuality";

describe("calculateStandupQuality", () => {
  it("calculates rounded metrics and score", () => {
    const result = calculateStandupQuality(
      [
        {
          summaryToday: "Ship API and UI integration for summary traceability.",
          progressSinceYesterday: "Implemented API response mapping.",
          blockers: "Waiting on deployment access",
          isComplete: true,
          linkedWorkCount: 2,
        },
        {
          summaryToday: "same",
          progressSinceYesterday: "same",
          blockers: null,
          isComplete: false,
          linkedWorkCount: 0,
        },
      ],
      4
    );

    expect(result.metrics).toEqual({
      completion_rate: 25,
      missing_linked_work_rate: 25,
      missing_blockers_rate: 25,
      vague_update_rate: 25,
    });
    expect(result.qualityScore).toBe(55);
  });
});

