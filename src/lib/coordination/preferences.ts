export type CoordinationNudgeCategory = "BLOCKERS" | "QUESTIONS" | "STANDUPS" | "OVERDUE_ACTIONS";

export type CoordinationChannel = "IN_APP";

export type CoordinationPreferences = {
  mutedCategories: CoordinationNudgeCategory[];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezoneOffsetMinutes: number;
  maxNudgesPerDay: number;
  channels: CoordinationChannel[];
};

export const DEFAULT_COORDINATION_PREFERENCES: CoordinationPreferences = {
  mutedCategories: [],
  quietHoursStart: null,
  quietHoursEnd: null,
  timezoneOffsetMinutes: 0,
  maxNudgesPerDay: 5,
  channels: ["IN_APP"],
};

export const mapRuleToCategory = (ruleId: string): CoordinationNudgeCategory => {
  if (ruleId === "question-unanswered-24h") return "QUESTIONS";
  if (ruleId === "missing-standup-two-days") return "STANDUPS";
  if (ruleId === "action-overdue") return "OVERDUE_ACTIONS";
  return "BLOCKERS";
};

export const isWithinQuietHours = (input: {
  when: Date;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezoneOffsetMinutes: number;
}) => {
  const { quietHoursStart, quietHoursEnd } = input;
  if (quietHoursStart === null || quietHoursEnd === null) return false;
  if (quietHoursStart === quietHoursEnd) return false;

  const shifted = new Date(input.when.getTime() + input.timezoneOffsetMinutes * 60 * 1000);
  const localHour = shifted.getUTCHours();

  if (quietHoursStart < quietHoursEnd) {
    return localHour >= quietHoursStart && localHour < quietHoursEnd;
  }

  return localHour >= quietHoursStart || localHour < quietHoursEnd;
};

export const normalizePreferencesInput = (input: Partial<CoordinationPreferences>): CoordinationPreferences => ({
  mutedCategories: Array.isArray(input.mutedCategories)
    ? input.mutedCategories.filter(
        (item): item is CoordinationNudgeCategory =>
          item === "BLOCKERS" || item === "QUESTIONS" || item === "STANDUPS" || item === "OVERDUE_ACTIONS"
      )
    : DEFAULT_COORDINATION_PREFERENCES.mutedCategories,
  quietHoursStart:
    typeof input.quietHoursStart === "number" && input.quietHoursStart >= 0 && input.quietHoursStart <= 23
      ? input.quietHoursStart
      : null,
  quietHoursEnd:
    typeof input.quietHoursEnd === "number" && input.quietHoursEnd >= 0 && input.quietHoursEnd <= 23 ? input.quietHoursEnd : null,
  timezoneOffsetMinutes:
    typeof input.timezoneOffsetMinutes === "number" && Number.isFinite(input.timezoneOffsetMinutes)
      ? Math.max(-720, Math.min(840, Math.round(input.timezoneOffsetMinutes)))
      : DEFAULT_COORDINATION_PREFERENCES.timezoneOffsetMinutes,
  maxNudgesPerDay:
    typeof input.maxNudgesPerDay === "number" && Number.isFinite(input.maxNudgesPerDay)
      ? Math.max(1, Math.min(20, Math.round(input.maxNudgesPerDay)))
      : DEFAULT_COORDINATION_PREFERENCES.maxNudgesPerDay,
  channels:
    Array.isArray(input.channels) && input.channels.includes("IN_APP") ? ["IN_APP"] : DEFAULT_COORDINATION_PREFERENCES.channels,
});
