export type NudgeRuleId =
  | "blocker-persisted-high-severity"
  | "missing-standup-two-days"
  | "question-unanswered-24h"
  | "action-overdue"
  | "snooze-expired-retrigger";

export type NudgeTemplateInput = {
  ruleId: NudgeRuleId;
  escalationLevel: number;
  blockerDays?: number;
  missingStandupDays?: number;
  unansweredHours?: number;
  blockerReason?: string;
};

export type NudgeCopy = {
  title: string;
  body: string;
};

const unansweredDays = (hours?: number) => {
  if (!hours || hours <= 0) return 1;
  return Math.max(1, Math.floor(hours / 24));
};

const escalationSuffix = (escalationLevel: number) =>
  escalationLevel > 1 ? ` Escalation level: L${escalationLevel}.` : "";

export const buildNudgeTemplate = (input: NudgeTemplateInput): NudgeCopy => {
  switch (input.ruleId) {
    case "missing-standup-two-days": {
      const days = input.missingStandupDays ?? 2;
      return {
        title: "Missing standup follow-up",
        body: `You haven’t submitted standup for ${days} days. Please update to keep sprint tracking accurate.${escalationSuffix(input.escalationLevel)}`,
      };
    }
    case "question-unanswered-24h": {
      const days = unansweredDays(input.unansweredHours);
      return {
        title: "Unanswered clarification reminder",
        body: `There’s an unanswered clarification request on your update from ${days === 1 ? "yesterday" : `${days} days ago`}.${escalationSuffix(input.escalationLevel)}`,
      };
    }
    case "action-overdue":
      return {
        title: "Action item overdue",
        body: `A committed action item is overdue and needs owner follow-through.${escalationSuffix(input.escalationLevel)}`,
      };
    case "snooze-expired-retrigger":
      return {
        title: "Snoozed reminder resumed",
        body: `Your snoozed coordination reminder is active again. Please review and take action.${escalationSuffix(input.escalationLevel)}`,
      };
    case "blocker-persisted-high-severity":
    default: {
      const days = input.blockerDays ?? 2;
      const reason = input.blockerReason?.trim() ? input.blockerReason.trim() : "an unresolved dependency";
      return {
        title: "Persistent blocker requires action",
        body: `Your task is blocked for ${days} days due to ${reason}. Do you still need assistance?${escalationSuffix(input.escalationLevel)}`,
      };
    }
  }
};
