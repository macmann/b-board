import { createHash } from "crypto";

import type {
  CapacitySignal,
  SprintExecutiveView,
  SprintGuidanceSuggestion,
  SprintHealthRiskDriver,
  SprintSuggestionState,
} from "./dto";

type GuidanceIssue = {
  id: string;
  key: string | null;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

type SuggestionStateRecord = {
  state: SprintSuggestionState;
  dismissedUntil: string | null;
  snoozedUntil: string | null;
};

type ProactiveGuidanceInput = {
  capacitySignals: CapacitySignal[];
  riskDrivers: SprintHealthRiskDriver[];
  staleIssues: GuidanceIssue[];
  persistentBlockersOver2Days: number;
  qualityScore: number | null;
  unresolvedActions: number;
  deliveryRisk: boolean;
  forecastConfidence: "HIGH" | "MEDIUM" | "LOW";
  velocitySampleDays: number;
  openActionIds: string[];
  projectRole: "ADMIN" | "PO" | "DEV" | "QA" | "VIEWER" | null;
  suggestionStateById: Map<string, SuggestionStateRecord>;
  proactiveGuidanceEnabled: boolean;
};

const IMPACT_BY_RISK: Record<string, number> = {
  BLOCKER_CLUSTER: 5,
  MISSING_STANDUP: 4,
  STALE_WORK: 4,
  LOW_QUALITY_INPUT: 3,
  UNRESOLVED_ACTIONS: 4,
  END_OF_SPRINT_PRESSURE: 5,
  DELIVERY_RISK: 6,
};

const impactBand = (score: number) => {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
};

const displayWorkItem = (workId: string) => {
  const [, id] = workId.split(":");
  return id ? `${workId.startsWith("issue:") ? "Issue" : "Research"} ${id}` : workId;
};

const normalizeSuggestionId = (type: SprintGuidanceSuggestion["type"], recommendation: string, evidence: string[]) => {
  const key = `${type}|${recommendation}|${evidence.slice(0, 4).join("|")}`;
  return createHash("sha1").update(key).digest("hex").slice(0, 12);
};

const applyLifecycleState = (
  suggestion: Omit<SprintGuidanceSuggestion, "id" | "state" | "dismissedUntil" | "snoozedUntil">,
  suggestionStateById: Map<string, SuggestionStateRecord>
): SprintGuidanceSuggestion | null => {
  const id = normalizeSuggestionId(suggestion.type, suggestion.recommendation, suggestion.evidence);
  const lifecycle = suggestionStateById.get(id);
  const now = new Date();

  const dismissedUntil = lifecycle?.dismissedUntil ?? null;
  const snoozedUntil = lifecycle?.snoozedUntil ?? null;

  const dismissActive = dismissedUntil ? new Date(dismissedUntil).getTime() > now.getTime() : false;
  const snoozeActive = snoozedUntil ? new Date(snoozedUntil).getTime() > now.getTime() : false;

  if (lifecycle?.state === "DISMISSED" && dismissActive) {
    return null;
  }

  if (lifecycle?.state === "SNOOZED" && snoozeActive) {
    return null;
  }

  return {
    ...suggestion,
    id,
    state: lifecycle?.state ?? "OPEN",
    dismissedUntil,
    snoozedUntil,
  };
};

const computeImpact = (score: number, statement: string) => ({
  impactScore: Math.max(0, Math.min(100, Math.round(score))),
  impactExplanation: `${impactBand(score)} expected effect. ${statement}`,
  formulaBasis: "impactScore = bounded weighted signal score (0-100) from overload/risk/quality/urgency metrics",
});

const buildReallocationSuggestions = (input: ProactiveGuidanceInput): SprintGuidanceSuggestion[] => {
  const overloaded = input.capacitySignals.filter((signal) => signal.type === "OVERLOADED");
  const idle = input.capacitySignals.filter((signal) => signal.type === "IDLE");
  const suggestions: SprintGuidanceSuggestion[] = [];

  overloaded.forEach((source) => {
    idle.forEach((target) => {
      const candidateWork = source.evidence.linkedWorkIds.find((id) => id.startsWith("issue:"))
        ?? source.evidence.linkedWorkIds[0];
      if (!candidateWork) return;

      const estimatedShift = Math.max(1, Math.min(2, source.openItems - source.thresholds.openItems));
      const score = 25 + source.openItems * 4 + target.idleDays * 3;
      const suggestion = applyLifecycleState(
        {
          type: "REALLOCATION",
          recommendation: `Consider reassigning ${displayWorkItem(candidateWork)} from ${source.name} to ${target.name} to balance workload.`,
          reason: `${source.name} is overloaded while ${target.name} has idle capacity.`,
          evidence: [
            `${source.name}:openItems=${source.openItems} threshold>${source.thresholds.openItems}`,
            `${target.name}:idleDays=${target.idleDays} threshold>=${target.thresholds.idleDays}`,
            `linkedWork:${candidateWork}`,
          ],
          impactEstimate: `May reduce ${source.name}'s active load by ~${estimatedShift} item(s) and activate an idle contributor.`,
          ...computeImpact(score, `Estimated shift of ${estimatedShift} item(s) from overloaded to idle contributor.`),
          requiresRole: "LEADERSHIP",
          ...(input.forecastConfidence === "LOW" ? { confidenceLabel: "LOW_CONFIDENCE" as const } : {}),
        },
        input.suggestionStateById
      );

      if (suggestion) suggestions.push(suggestion);
    });
  });

  return suggestions.slice(0, 3);
};

const buildScopeAdjustmentSuggestions = (input: ProactiveGuidanceInput): SprintGuidanceSuggestion[] => {
  const isPOAdmin = input.projectRole === "PO" || input.projectRole === "ADMIN";
  const hasRiskEvidence = input.riskDrivers.some((driver) => driver.type === "DELIVERY_RISK" || driver.type === "END_OF_SPRINT_PRESSURE");
  const lowPriorityCandidates = input.staleIssues.filter((issue) => issue.priority === "LOW").slice(0, 3);
  const deliveryRiskHigh = input.deliveryRisk || input.forecastConfidence === "LOW";

  if (!isPOAdmin || !deliveryRiskHigh || !hasRiskEvidence || lowPriorityCandidates.length === 0) {
    return [];
  }

  const candidateLabels = lowPriorityCandidates.map((issue) => issue.key || issue.id);
  const score = 35 + lowPriorityCandidates.length * 12 + (input.deliveryRisk ? 20 : 0);
  const suggestion = applyLifecycleState(
    {
      type: "SCOPE_ADJUSTMENT",
      recommendation: `Consider deferring low-priority stale items: ${candidateLabels.join(", ")}.`,
      reason: "Delivery risk is elevated, confidence is constrained, and candidates are low-priority stale work.",
      evidence: [
        `riskDrivers:${input.riskDrivers.filter((driver) => driver.impact < 0).map((driver) => driver.type).join("|") || "n/a"}`,
        `forecastConfidence=${input.forecastConfidence}`,
        `lowPriorityStaleItems=${lowPriorityCandidates.length}`,
      ],
      impactEstimate: `Deferring ${lowPriorityCandidates.length} low-priority item(s) can reduce near-term scope pressure.`,
      ...computeImpact(score, `Scope load reduced by ${lowPriorityCandidates.length} low-priority stale item(s).`),
      requiresRole: "PO_OR_ADMIN",
      ...(input.forecastConfidence === "LOW" ? { confidenceLabel: "LOW_CONFIDENCE" as const } : {}),
    },
    input.suggestionStateById
  );

  return suggestion ? [suggestion] : [];
};

const buildMeetingOptimizationSuggestions = (input: ProactiveGuidanceInput): SprintGuidanceSuggestion[] => {
  const suggestions: SprintGuidanceSuggestion[] = [];

  if (input.qualityScore !== null && input.qualityScore < 60) {
    const suggestion = applyLifecycleState(
      {
        type: "MEETING_OPTIMIZATION",
        recommendation: "Schedule a focused blocker-resolution session today.",
        reason: "Standup signal quality is low while unresolved follow-ups remain high.",
        evidence: [
          `qualityScore=${input.qualityScore}(<60)`,
          `unresolvedActions=${input.unresolvedActions}`,
        ],
        impactEstimate: "Can convert ambiguous blockers into assigned owners and time-boxed decisions.",
        ...computeImpact(40 + Math.max(0, 60 - input.qualityScore), "Improves blocker clarity and decision velocity."),
        requiresRole: "LEADERSHIP",
      },
      input.suggestionStateById
    );

    if (suggestion) suggestions.push(suggestion);
  }

  if (input.persistentBlockersOver2Days > 0) {
    const suggestion = applyLifecycleState(
      {
        type: "MEETING_OPTIMIZATION",
        recommendation: "Run a short dependency clarification sync with affected owners.",
        reason: "Repeated blocker patterns are persisting across days.",
        evidence: [`persistentBlockersOver2Days=${input.persistentBlockersOver2Days}`],
        impactEstimate: "Should reduce repeated blocker carry-over in the next standup cycle.",
        ...computeImpact(35 + input.persistentBlockersOver2Days * 10, "Targets repeated blocker chains through dependency alignment."),
        requiresRole: "LEADERSHIP",
      },
      input.suggestionStateById
    );

    if (suggestion) suggestions.push(suggestion);
  }

  return suggestions.slice(0, 3);
};

const deduplicateStructuralVsActions = (suggestions: SprintGuidanceSuggestion[], openActionIds: string[]) => {
  const normalizedActionIds = new Set(openActionIds.map((id) => id.toLowerCase()));
  return suggestions.filter((suggestion) => {
    const recommendation = suggestion.recommendation.toLowerCase();
    if (recommendation.includes("follow up") || recommendation.includes("follow-up")) {
      return false;
    }

    const evidenceActionRefs = suggestion.evidence.some((item) => {
      const maybe = item.toLowerCase().replace("action:", "");
      return normalizedActionIds.has(maybe);
    });

    return !evidenceActionRefs;
  });
};

const scoreRisk = (driver: SprintHealthRiskDriver) => {
  const base = IMPACT_BY_RISK[driver.type] ?? 1;
  return base * Math.max(1, Math.abs(driver.impact));
};

const buildExecutiveView = (
  input: ProactiveGuidanceInput,
  suggestions: SprintGuidanceSuggestion[]
): SprintExecutiveView => {
  const topRisks = input.riskDrivers
    .filter((driver) => driver.impact < 0)
    .sort((a, b) => scoreRisk(b) - scoreRisk(a))
    .slice(0, 3)
    .map((driver) => `${driver.type} (${driver.impact}) • ${driver.evidence.slice(0, 2).join(", ") || "evidence:n/a"}`);

  const topActions = suggestions
    .slice(0, 3)
    .map((suggestion) => suggestion.recommendation);

  const todaysFocus = [
    input.deliveryRisk ? "Protect sprint delivery by reducing immediate scope/flow risk." : "Maintain steady execution and prevent new blockers.",
    input.unresolvedActions > 5
      ? "Use Action Center to close aged open actions first."
      : "Track action ownership in Action Center and keep queue size low.",
    input.persistentBlockersOver2Days > 0
      ? "Break repeated blocker loops by resolving dependency root causes."
      : "Preserve blocker response speed to sustain momentum.",
  ];

  const suggestedStructuralAdjustment = suggestions[0]?.recommendation ?? null;

  return {
    todaysFocus,
    topRisks,
    topActions,
    suggestedStructuralAdjustment,
  };
};

export const buildProactiveSprintGuidance = (input: ProactiveGuidanceInput) => {
  if (!input.proactiveGuidanceEnabled) {
    return {
      reallocationSuggestions: [] as SprintGuidanceSuggestion[],
      scopeAdjustmentSuggestions: [] as SprintGuidanceSuggestion[],
      meetingOptimizationSuggestions: [] as SprintGuidanceSuggestion[],
      executiveView: buildExecutiveView(input, []),
    };
  }

  const lowConfidenceMode = input.forecastConfidence === "LOW";

  const meetingOptimizationSuggestions = buildMeetingOptimizationSuggestions(input);

  const reallocationSuggestions = lowConfidenceMode
    ? []
    : buildReallocationSuggestions(input);

  const scopeAdjustmentSuggestions = lowConfidenceMode
    ? []
    : buildScopeAdjustmentSuggestions(input);

  const deduped = deduplicateStructuralVsActions(
    [...reallocationSuggestions, ...scopeAdjustmentSuggestions, ...meetingOptimizationSuggestions],
    input.openActionIds
  );

  const suggestionById = new Map(deduped.map((item) => [item.id, item] as const));
  const filteredReallocation = reallocationSuggestions.filter((item) => suggestionById.has(item.id));
  const filteredScope = scopeAdjustmentSuggestions.filter((item) => suggestionById.has(item.id));
  const filteredMeeting = meetingOptimizationSuggestions.filter((item) => suggestionById.has(item.id));

  const executiveView = buildExecutiveView(input, deduped);

  return {
    reallocationSuggestions: filteredReallocation,
    scopeAdjustmentSuggestions: filteredScope,
    meetingOptimizationSuggestions: filteredMeeting,
    executiveView,
  };
};
