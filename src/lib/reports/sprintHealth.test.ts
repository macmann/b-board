import { describe, expect, it } from "vitest";

import { computeSprintHealthScore } from "./sprintHealth";

describe("computeSprintHealthScore", () => {
  it("applies deterministic penalties and publishes transparent probability metadata", () => {
    const result = computeSprintHealthScore({
      persistentBlockersOver2Days: 2,
      missingStandupMembers: 1,
      staleWorkCount: 3,
      unresolvedActions: 7,
      qualityScore: 55,
      teamSize: 5,
      activeTaskCount: 12,
      daysRemainingInSprint: 2,
    });

    expect(result.healthScore).toBeLessThan(70);
    expect(result.status).toBe("RED");
    expect(result.riskDrivers.map((driver) => driver.type)).toEqual(
      expect.arrayContaining([
        "BLOCKER_CLUSTER",
        "MISSING_STANDUP",
        "STALE_WORK",
        "LOW_QUALITY_INPUT",
        "UNRESOLVED_ACTIONS",
        "END_OF_SPRINT_PRESSURE",
      ])
    );
    expect(result.probabilityModel.name).toBe("linear-health-score-v1");
    expect(result.probabilities.sprintSuccess + result.probabilities.spillover).toBe(100);
    expect(result.scoringModelVersion).toBe("3.1.1");
  });

  it("normalizes penalties by team size", () => {
    const smallTeam = computeSprintHealthScore({
      persistentBlockersOver2Days: 2,
      missingStandupMembers: 1,
      staleWorkCount: 1,
      unresolvedActions: 3,
      qualityScore: 85,
      teamSize: 3,
      activeTaskCount: 6,
      daysRemainingInSprint: null,
    });

    const largeTeam = computeSprintHealthScore({
      persistentBlockersOver2Days: 2,
      missingStandupMembers: 1,
      staleWorkCount: 1,
      unresolvedActions: 3,
      qualityScore: 85,
      teamSize: 20,
      activeTaskCount: 40,
      daysRemainingInSprint: null,
    });

    expect(smallTeam.healthScore).toBeLessThan(largeTeam.healthScore);
    expect(smallTeam.normalizedMetrics.blockerRatePerMember).toBeGreaterThan(
      largeTeam.normalizedMetrics.blockerRatePerMember
    );
    expect(smallTeam.normalizedMetrics.missingStandupRate).toBeGreaterThan(
      largeTeam.normalizedMetrics.missingStandupRate
    );
  });
});
