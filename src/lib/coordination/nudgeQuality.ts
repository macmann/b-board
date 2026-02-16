import type { CoordinationSeverity } from "./types";

const severityRank: Record<CoordinationSeverity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export type NudgeQualityMetrics = {
  resolvedRate: number;
  dismissedRate: number;
};

export const calculateNudgeQualityMetrics = (input: {
  resolvedCount: number;
  dismissedCount: number;
}): NudgeQualityMetrics => {
  const total = input.resolvedCount + input.dismissedCount;
  if (total <= 0) {
    return { resolvedRate: 1, dismissedRate: 0 };
  }

  return {
    resolvedRate: input.resolvedCount / total,
    dismissedRate: input.dismissedCount / total,
  };
};

export const reduceSeverity = (severity: CoordinationSeverity): CoordinationSeverity => {
  if (severity === "HIGH") return "MEDIUM";
  if (severity === "MEDIUM") return "LOW";
  return "LOW";
};

export const maybeAdjustSeverityForDismissalRate = (input: {
  severity: CoordinationSeverity;
  dismissedRate: number;
  dismissalRateThreshold: number;
}): CoordinationSeverity => {
  if (input.dismissedRate <= input.dismissalRateThreshold) return input.severity;
  if (severityRank[input.severity] <= severityRank.LOW) return "LOW";
  return reduceSeverity(input.severity);
};
