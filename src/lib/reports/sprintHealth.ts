export type SprintHealthStatus = "GREEN" | "YELLOW" | "RED";
export type SprintHealthConfidence = "HIGH" | "MEDIUM" | "LOW";

export type SprintHealthRiskDriverType =
  | "BLOCKER_CLUSTER"
  | "MISSING_STANDUP"
  | "STALE_WORK"
  | "LOW_QUALITY_INPUT"
  | "UNRESOLVED_ACTIONS"
  | "END_OF_SPRINT_PRESSURE"
  | "OVERLAP_DEDUP_CREDIT"
  | "DELIVERY_RISK";

export type SprintHealthRiskDriver = {
  type: SprintHealthRiskDriverType;
  impact: number;
  evidence: string[];
};

export type SprintHealthInput = {
  persistentBlockersOver2Days: number;
  missingStandupMembers: number;
  staleWorkCount: number;
  unresolvedActions: number;
  qualityScore: number | null;
  teamSize: number;
  activeTaskCount: number;
  daysRemainingInSprint: number | null;
};

export type SprintHealthScoreBreakdownItem = {
  reason: string;
  impact: number;
  evidence: string[];
};

export type SprintHealthComputation = {
  healthScore: number;
  status: SprintHealthStatus;
  confidenceLevel: SprintHealthConfidence;
  confidenceBasis: {
    dataCompleteness: number;
    signalStability: number;
    sampleSize: number;
  };
  riskDrivers: SprintHealthRiskDriver[];
  scoreBreakdown: SprintHealthScoreBreakdownItem[];
  probabilities: {
    sprintSuccess: number;
    spillover: number;
  };
  probabilityModel: {
    name: "linear-health-score-v1";
    formula: "successProbability = clamp(healthScore / 100, 0, 1); spilloverProbability = 1 - successProbability";
  };
  normalizedMetrics: {
    blockerRatePerMember: number;
    missingStandupRate: number;
    staleWorkRatePerActiveTask: number;
    unresolvedActionsRatePerMember: number;
  };
  scoringModelVersion: string;
};

export const SPRINT_HEALTH_SCORING_MODEL_VERSION = "3.1.1";

const HEALTH_MODEL = {
  baseScore: 100,
  staleWorkMaxPenalty: 20,
  staleWorkUnitPenalty: 3,
  qualityThreshold: 60,
  qualityPenalty: 10,
  unresolvedActionsThreshold: 5,
  unresolvedActionsPenalty: 10,
  endSprintDaysThreshold: 3,
  endSprintUnresolvedThreshold: 3,
  endSprintPenalty: 8,
  overlapDedupCap: 8,
} as const;

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizedScale = (numerator: number, denominator: number) => {
  const safeDenominator = Math.max(1, denominator);
  return clamp(numerator / safeDenominator, 0, 1.5);
};

const toStatus = (score: number): SprintHealthStatus => {
  if (score >= 80) return "GREEN";
  if (score >= 60) return "YELLOW";
  return "RED";
};

const toConfidence = (basis: {
  dataCompleteness: number;
  signalStability: number;
  sampleSize: number;
}): SprintHealthConfidence => {
  const weighted =
    basis.dataCompleteness * 0.45 +
    basis.signalStability * 0.35 +
    clamp(basis.sampleSize / 8, 0, 1) * 0.2;

  if (weighted >= 0.75) return "HIGH";
  if (weighted >= 0.5) return "MEDIUM";
  return "LOW";
};

export const computeSprintHealthScore = (
  input: SprintHealthInput
): SprintHealthComputation => {
  const breakdown: SprintHealthScoreBreakdownItem[] = [];
  const riskDrivers: SprintHealthRiskDriver[] = [];

  const blockerRatePerMember = normalizedScale(
    input.persistentBlockersOver2Days,
    input.teamSize
  );
  const missingStandupRate = normalizedScale(
    input.missingStandupMembers,
    input.teamSize
  );
  const staleWorkRatePerActiveTask = normalizedScale(
    input.staleWorkCount,
    input.activeTaskCount
  );
  const unresolvedActionsRatePerMember = normalizedScale(
    input.unresolvedActions,
    input.teamSize
  );

  const persistentBlockerPenalty = Math.round(
    input.persistentBlockersOver2Days * 15 * (0.6 + blockerRatePerMember)
  );
  if (persistentBlockerPenalty > 0) {
    breakdown.push({
      reason: "Persistent blockers > 2 days (team-normalized)",
      impact: -persistentBlockerPenalty,
      evidence: [`clusters:${input.persistentBlockersOver2Days}`, `rate:${round2(blockerRatePerMember)}`],
    });
    riskDrivers.push({
      type: "BLOCKER_CLUSTER",
      impact: -persistentBlockerPenalty,
      evidence: [`clusters:${input.persistentBlockersOver2Days}`, `rate:${round2(blockerRatePerMember)}`],
    });
  }

  const missingStandupPenalty = Math.round(
    input.missingStandupMembers * 10 * (0.5 + missingStandupRate)
  );
  if (missingStandupPenalty > 0) {
    breakdown.push({
      reason: "Missing standup members (team-normalized)",
      impact: -missingStandupPenalty,
      evidence: [`members:${input.missingStandupMembers}`, `rate:${round2(missingStandupRate)}`],
    });
    riskDrivers.push({
      type: "MISSING_STANDUP",
      impact: -missingStandupPenalty,
      evidence: [`members:${input.missingStandupMembers}`, `rate:${round2(missingStandupRate)}`],
    });
  }

  const staleWorkPenalty = Math.min(
    HEALTH_MODEL.staleWorkMaxPenalty,
    Math.round(
      input.staleWorkCount *
        HEALTH_MODEL.staleWorkUnitPenalty *
        (0.7 + staleWorkRatePerActiveTask)
    )
  );
  if (staleWorkPenalty > 0) {
    breakdown.push({
      reason: "Stale linked work (scope-normalized)",
      impact: -staleWorkPenalty,
      evidence: [`issues:${input.staleWorkCount}`, `rate:${round2(staleWorkRatePerActiveTask)}`],
    });
    riskDrivers.push({
      type: "STALE_WORK",
      impact: -staleWorkPenalty,
      evidence: [`issues:${input.staleWorkCount}`, `rate:${round2(staleWorkRatePerActiveTask)}`],
    });
  }

  if (
    input.qualityScore !== null &&
    input.qualityScore < HEALTH_MODEL.qualityThreshold
  ) {
    breakdown.push({
      reason: `Quality score below ${HEALTH_MODEL.qualityThreshold}`,
      impact: -HEALTH_MODEL.qualityPenalty,
      evidence: [`quality:${input.qualityScore}`],
    });
    riskDrivers.push({
      type: "LOW_QUALITY_INPUT",
      impact: -HEALTH_MODEL.qualityPenalty,
      evidence: [`quality:${input.qualityScore}`],
    });
  }

  if (input.unresolvedActions > HEALTH_MODEL.unresolvedActionsThreshold) {
    const unresolvedPenalty = Math.round(
      HEALTH_MODEL.unresolvedActionsPenalty *
        (0.5 + unresolvedActionsRatePerMember)
    );
    breakdown.push({
      reason: `Unresolved actions above ${HEALTH_MODEL.unresolvedActionsThreshold} (team-normalized)`,
      impact: -unresolvedPenalty,
      evidence: [`actions:${input.unresolvedActions}`, `rate:${round2(unresolvedActionsRatePerMember)}`],
    });
    riskDrivers.push({
      type: "UNRESOLVED_ACTIONS",
      impact: -unresolvedPenalty,
      evidence: [`actions:${input.unresolvedActions}`, `rate:${round2(unresolvedActionsRatePerMember)}`],
    });
  }

  if (
    input.daysRemainingInSprint !== null &&
    input.daysRemainingInSprint <= HEALTH_MODEL.endSprintDaysThreshold &&
    input.unresolvedActions >= HEALTH_MODEL.endSprintUnresolvedThreshold
  ) {
    breakdown.push({
      reason: "End-of-sprint pressure",
      impact: -HEALTH_MODEL.endSprintPenalty,
      evidence: [
        `daysRemaining:${input.daysRemainingInSprint}`,
        `unresolvedActions:${input.unresolvedActions}`,
      ],
    });
    riskDrivers.push({
      type: "END_OF_SPRINT_PRESSURE",
      impact: -HEALTH_MODEL.endSprintPenalty,
      evidence: [
        `daysRemaining:${input.daysRemainingInSprint}`,
        `unresolvedActions:${input.unresolvedActions}`,
      ],
    });
  }

  const hasOverlap =
    persistentBlockerPenalty > 0 && staleWorkPenalty > 0 && input.unresolvedActions > 0;
  if (hasOverlap) {
    const dedupCredit = Math.min(
      HEALTH_MODEL.overlapDedupCap,
      Math.max(2, Math.round((staleWorkPenalty + persistentBlockerPenalty) * 0.12))
    );
    breakdown.push({
      reason: "Cross-signal overlap de-duplication",
      impact: dedupCredit,
      evidence: ["overlap:blockers+stale+actions"],
    });
    riskDrivers.push({
      type: "OVERLAP_DEDUP_CREDIT",
      impact: dedupCredit,
      evidence: ["overlap:blockers+stale+actions"],
    });
  }

  const totalDelta = breakdown.reduce((sum, item) => sum + item.impact, 0);
  const healthScore = clamp(HEALTH_MODEL.baseScore + totalDelta, 0, 100);

  const successProbability = clamp(healthScore / 100, 0, 1);
  const sprintSuccess = Math.round(successProbability * 100);
  const spillover = Math.round((1 - successProbability) * 100);

  const dataCompleteness = clamp(1 - missingStandupRate * 0.8, 0, 1);
  const maxSinglePenalty = Math.max(
    0,
    ...breakdown
      .filter((item) => item.impact < 0)
      .map((item) => Math.abs(item.impact))
  );
  const totalNegativePenalty = Math.max(
    1,
    breakdown
      .filter((item) => item.impact < 0)
      .reduce((sum, item) => sum + Math.abs(item.impact), 0)
  );
  const concentration = clamp(maxSinglePenalty / totalNegativePenalty, 0, 1);
  const signalStability = clamp(1 - concentration * 0.5, 0, 1);
  const sampleSize = input.teamSize;

  const confidenceBasis = {
    dataCompleteness: round2(dataCompleteness),
    signalStability: round2(signalStability),
    sampleSize,
  };

  return {
    healthScore,
    status: toStatus(healthScore),
    confidenceLevel: toConfidence(confidenceBasis),
    confidenceBasis,
    riskDrivers,
    scoreBreakdown: [
      {
        reason: "Base score",
        impact: HEALTH_MODEL.baseScore,
        evidence: ["deterministic"],
      },
      ...breakdown,
    ],
    probabilities: {
      sprintSuccess,
      spillover,
    },
    probabilityModel: {
      name: "linear-health-score-v1",
      formula:
        "successProbability = clamp(healthScore / 100, 0, 1); spilloverProbability = 1 - successProbability",
    },
    normalizedMetrics: {
      blockerRatePerMember: round2(blockerRatePerMember),
      missingStandupRate: round2(missingStandupRate),
      staleWorkRatePerActiveTask: round2(staleWorkRatePerActiveTask),
      unresolvedActionsRatePerMember: round2(unresolvedActionsRatePerMember),
    },
    scoringModelVersion: SPRINT_HEALTH_SCORING_MODEL_VERSION,
  };
};
