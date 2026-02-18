import { NextRequest, NextResponse } from "next/server";

import { resolveProjectId, type ProjectParams } from "../params";
import { formatReportDate, parseReportFilter } from "./filters";

export type ReportFilters = {
  projectId: string;
  from: string;
  to: string;
  sprintId?: string | "all";
};

export type BurndownPoint = {
  date: string;
  remainingPoints: number;
  remainingIssues: number;
};

export type VelocityPoint = {
  sprintId: string;
  sprintName: string;
  completedPoints: number;
  completedIssues: number;
  startDate?: string;
  endDate?: string;
};

export type CycleTimePoint = {
  issueId: string;
  key: string;
  title: string;
  startedAt?: string;
  doneAt?: string;
  cycleTimeDays?: number;
};

export type CycleTimeSummary = {
  median: number | null;
  p75: number | null;
  p90: number | null;
};

export type StandupInsight = {
  date: string;
  entryIds: string[];
  blockersCount: number;
  dependenciesCount: number;
  updatesCount: number;
  topBlockers: string[];
  hasAiSummary: boolean;
  summaryExcerpt?: string;
  summary?: string;
};

export type StandupSignalType =
  | "MISSING_STANDUP"
  | "PERSISTENT_BLOCKER"
  | "STALE_WORK"
  | "LOW_CONFIDENCE";

export type StandupSignal = {
  id: string;
  signal_type: StandupSignalType;
  owner_user_id: string;
  owner_name: string;
  severity: "low" | "medium" | "high";
  since: string;
  evidence_entry_ids: string[];
  linked_work_ids: string[];
};

export type StandupSignalDefinition = {
  timezone: "UTC";
  cutoff_hour_utc: number;
  grace_minutes: number;
  threshold: string;
  description: string;
};

export type StandupInsightsReport = {
  daily: StandupInsight[];
  signals: StandupSignal[];
  signalDefinitions: Record<StandupSignalType, StandupSignalDefinition>;
};

export type SprintHealthRiskDriver = {
  type:
    | "BLOCKER_CLUSTER"
    | "MISSING_STANDUP"
    | "STALE_WORK"
    | "LOW_QUALITY_INPUT"
    | "UNRESOLVED_ACTIONS"
    | "END_OF_SPRINT_PRESSURE"
    | "OVERLAP_DEDUP_CREDIT"
    | "DELIVERY_RISK";
  impact: number;
  evidence: string[];
};

export type SprintHealthBreakdown = {
  reason: string;
  impact: number;
  evidence: string[];
};

export type SprintHealthDailyPoint = {
  date: string;
  healthScore: number;
  status: "GREEN" | "YELLOW" | "RED";
};


export type CapacitySignalType =
  | "OVERLOADED"
  | "MULTI_BLOCKED"
  | "IDLE";

export type CapacitySignal = {
  userId: string;
  name: string;
  type: CapacitySignalType;
  openItems: number;
  blockedItems: number;
  idleDays: number;
  thresholds: {
    openItems: number;
    blockedItems: number;
    idleDays: number;
  };
  evidence: {
    entryIds: string[];
    linkedWorkIds: string[];
  };
  message: string;
};

export type ProjectionDefinitions = {
  modelVersion: string;
  completionDefinition: string;
  remainingWorkDefinition: string;
  weightingModel: string;
  warning: string;
  confidenceWeights: {
    dataQuality: number;
    velocityStability: number;
    blockerVolatility: number;
    linkedCoverage: number;
  };
  confidenceThresholds: {
    high: number;
    medium: number;
    minimumSampleDays: number;
  };
  capacityThresholds: {
    openItems: number;
    blockedItems: number;
    idleDays: number;
  };
};

export type SprintVelocitySnapshot = {
  avgTasksCompletedPerDay: number;
  avgBlockerResolutionHours: number | null;
  avgActionResolutionHours: number | null;
  completionRatePerDay: number;
  remainingLinkedWork: number;
  weightedRemainingWork: number;
  projectedCompletionDate: string | null;
  projectedCompletionDateSmoothed?: string | null;
  projectedDateDeltaDays?: number;
  deliveryRisk: boolean;
  linkedWorkCoverage: number;
  sampleSizeDays: number;
  scopeAddedWorkCount: number;
  scopeRemovedWorkCount: number;
  scopeChangeSummary: string;
  sprint: {
    id: string | null;
    name: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  projectionModelVersion: string;
  projectionDefinitions: ProjectionDefinitions;
  unweightedProjectionWarning: boolean;
};

export type SprintSuggestionState = "OPEN" | "ACCEPTED" | "DISMISSED" | "SNOOZED";

export type SprintGuidanceSuggestion = {
  id: string;
  type: "REALLOCATION" | "SCOPE_ADJUSTMENT" | "MEETING_OPTIMIZATION";
  recommendation: string;
  reason: string;
  evidence: string[];
  impactEstimate: string;
  impactScore: number;
  impactExplanation: string;
  formulaBasis: string;
  confidenceLabel?: "LOW_CONFIDENCE";
  state: SprintSuggestionState;
  dismissedUntil: string | null;
  snoozedUntil: string | null;
  requiresRole: "PO_OR_ADMIN" | "LEADERSHIP";
};

export type SprintExecutiveView = {
  todaysFocus: string[];
  topRisks: string[];
  topActions: string[];
  suggestedStructuralAdjustment: string | null;
};

export type SprintHealthReport = {
  date: string;
  healthScore: number;
  smoothedHealthScore: number;
  status: "GREEN" | "YELLOW" | "RED";
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  confidenceBasis: {
    dataCompleteness: number;
    signalStability: number;
    sampleSize: number;
  };
  scoreBreakdown: SprintHealthBreakdown[];
  riskDrivers: SprintHealthRiskDriver[];
  probabilities: {
    sprintSuccess: number;
    spillover: number;
  };
  probabilityModel: {
    name: "linear-health-score-v1";
    formula: string;
  };
  normalizedMetrics: {
    blockerRatePerMember: number;
    missingStandupRate: number;
    staleWorkRatePerActiveTask: number;
    unresolvedActionsRatePerMember: number;
  };
  scoringModelVersion: string;
  riskConcentrationAreas: string[];
  concentrationIndex: number;
  staleWorkCount: number;
  missingStandupMembers: number;
  persistentBlockersOver2Days: number;
  unresolvedActions: number;
  qualityScore: number | null;
  trend14d: SprintHealthDailyPoint[];
  riskDeltaSinceYesterday: number;
  trendIndicator: "IMPROVED" | "DEGRADED" | "UNCHANGED";
  velocitySnapshot: SprintVelocitySnapshot;
  capacitySignals: CapacitySignal[];
  forecastConfidence: "HIGH" | "MEDIUM" | "LOW";
  proactiveGuidanceEnabled: boolean;
  reallocationSuggestions: SprintGuidanceSuggestion[];
  scopeAdjustmentSuggestions: SprintGuidanceSuggestion[];
  meetingOptimizationSuggestions: SprintGuidanceSuggestion[];
  executiveView: SprintExecutiveView;
};

export type BlockerTheme = {
  theme: string;
  count: number;
  examples: string[];
};

export type CycleTimeReport = {
  points: CycleTimePoint[];
  summary: CycleTimeSummary;
};

const invalidResponse = (message: string, status = 400) =>
  NextResponse.json({ ok: false, message }, { status });

export async function parseReportFilters(
  request: NextRequest,
  params: ProjectParams
): Promise<{ filters: ReportFilters } | { error: NextResponse }> {
  const projectId = await resolveProjectId(params);

  if (!projectId) {
    return { error: invalidResponse("projectId is required", 400) };
  }

  const searchParams = request.nextUrl.searchParams;
  const sprintId = searchParams.get("sprintId") ?? undefined;

  const range = parseReportFilter(searchParams, { projectId });
  const resolvedProjectId = range.projectId ?? projectId;
  if (!resolvedProjectId) {
    return { error: invalidResponse("projectId is required", 400) };
  }

  return {
    filters: {
      projectId: resolvedProjectId,
      from: formatReportDate(range.from),
      to: formatReportDate(range.to),
      ...(sprintId ? { sprintId } : {}),
    },
  };
}
