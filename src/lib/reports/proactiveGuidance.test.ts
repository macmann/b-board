import { describe, expect, it } from "vitest";

import { buildProactiveSprintGuidance } from "./proactiveGuidance";

describe("buildProactiveSprintGuidance", () => {
  it("generates deterministic suggestions with impact metadata and lifecycle state", () => {
    const result = buildProactiveSprintGuidance({
      capacitySignals: [
        {
          userId: "a",
          name: "Contributor A",
          type: "OVERLOADED",
          openItems: 8,
          blockedItems: 2,
          idleDays: 0,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: ["e1"], linkedWorkIds: ["issue:ISS-1", "research:res-1"] },
          message: "overloaded",
        },
        {
          userId: "b",
          name: "Contributor B",
          type: "IDLE",
          openItems: 0,
          blockedItems: 0,
          idleDays: 6,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: ["e2"], linkedWorkIds: [] },
          message: "idle",
        },
      ],
      riskDrivers: [
        { type: "DELIVERY_RISK", impact: -10, evidence: ["projectedCompletion:2026-01-31", "sprintEnd:2026-01-28"] },
        { type: "STALE_WORK", impact: -8, evidence: ["issue:ISS-2"] },
      ],
      staleIssues: [
        { id: "iss-2", key: "ISS-2", title: "Refactor docs", priority: "LOW" },
        { id: "iss-3", key: "ISS-3", title: "Clean lint", priority: "LOW" },
      ],
      persistentBlockersOver2Days: 2,
      qualityScore: 50,
      unresolvedActions: 7,
      deliveryRisk: true,
      forecastConfidence: "MEDIUM",
      velocitySampleDays: 6,
      openActionIds: [],
      projectRole: "PO",
      suggestionStateById: new Map(),
      proactiveGuidanceEnabled: true,
    });

    expect(result.reallocationSuggestions[0]?.id).toBeTruthy();
    expect(result.reallocationSuggestions[0]?.impactScore).toBeGreaterThan(0);
    expect(result.scopeAdjustmentSuggestions[0]?.recommendation).toContain("Consider deferring");
    expect(result.scopeAdjustmentSuggestions[0]?.requiresRole).toBe("PO_OR_ADMIN");
    expect(result.meetingOptimizationSuggestions.length).toBeGreaterThan(0);
  });

  it("suppresses reallocation and scope suggestions when forecast confidence is low", () => {
    const result = buildProactiveSprintGuidance({
      capacitySignals: [
        {
          userId: "a",
          name: "A",
          type: "OVERLOADED",
          openItems: 7,
          blockedItems: 0,
          idleDays: 0,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: [], linkedWorkIds: ["issue:ISS-1"] },
          message: "",
        },
        {
          userId: "b",
          name: "B",
          type: "IDLE",
          openItems: 0,
          blockedItems: 0,
          idleDays: 6,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: [], linkedWorkIds: [] },
          message: "",
        },
      ],
      riskDrivers: [{ type: "DELIVERY_RISK", impact: -10, evidence: ["risk"] }],
      staleIssues: [{ id: "iss", key: "ISS", title: "T", priority: "LOW" }],
      persistentBlockersOver2Days: 1,
      qualityScore: 50,
      unresolvedActions: 8,
      deliveryRisk: true,
      forecastConfidence: "LOW",
      velocitySampleDays: 2,
      openActionIds: [],
      projectRole: "PO",
      suggestionStateById: new Map(),
      proactiveGuidanceEnabled: true,
    });

    expect(result.reallocationSuggestions).toEqual([]);
    expect(result.scopeAdjustmentSuggestions).toEqual([]);
    expect(result.meetingOptimizationSuggestions.length).toBeGreaterThan(0);
  });

  it("hides dismissed suggestions until dismissal window expires", () => {
    const suggestionStateById = new Map<string, { state: "OPEN" | "ACCEPTED" | "DISMISSED" | "SNOOZED"; dismissedUntil: string | null; snoozedUntil: string | null }>();

    // Build once to know deterministic id.
    const baseline = buildProactiveSprintGuidance({
      capacitySignals: [
        {
          userId: "a",
          name: "A",
          type: "OVERLOADED",
          openItems: 8,
          blockedItems: 0,
          idleDays: 0,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: [], linkedWorkIds: ["issue:ISS-1"] },
          message: "",
        },
        {
          userId: "b",
          name: "B",
          type: "IDLE",
          openItems: 0,
          blockedItems: 0,
          idleDays: 6,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: [], linkedWorkIds: [] },
          message: "",
        },
      ],
      riskDrivers: [],
      staleIssues: [],
      persistentBlockersOver2Days: 0,
      qualityScore: 90,
      unresolvedActions: 1,
      deliveryRisk: false,
      forecastConfidence: "HIGH",
      velocitySampleDays: 7,
      openActionIds: [],
      projectRole: "ADMIN",
      suggestionStateById,
      proactiveGuidanceEnabled: true,
    });

    const id = baseline.reallocationSuggestions[0]?.id;
    expect(id).toBeTruthy();
    suggestionStateById.set(id!, {
      state: "DISMISSED",
      dismissedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      snoozedUntil: null,
    });

    const suppressed = buildProactiveSprintGuidance({
      capacitySignals: [
        {
          userId: "a",
          name: "A",
          type: "OVERLOADED",
          openItems: 8,
          blockedItems: 0,
          idleDays: 0,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: [], linkedWorkIds: ["issue:ISS-1"] },
          message: "",
        },
        {
          userId: "b",
          name: "B",
          type: "IDLE",
          openItems: 0,
          blockedItems: 0,
          idleDays: 6,
          thresholds: { openItems: 5, blockedItems: 2, idleDays: 5 },
          evidence: { entryIds: [], linkedWorkIds: [] },
          message: "",
        },
      ],
      riskDrivers: [],
      staleIssues: [],
      persistentBlockersOver2Days: 0,
      qualityScore: 90,
      unresolvedActions: 1,
      deliveryRisk: false,
      forecastConfidence: "HIGH",
      velocitySampleDays: 7,
      openActionIds: [],
      projectRole: "ADMIN",
      suggestionStateById,
      proactiveGuidanceEnabled: true,
    });

    expect(suppressed.reallocationSuggestions).toEqual([]);
  });
});
