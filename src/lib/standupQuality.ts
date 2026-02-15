import type { DailyStandupEntry } from "@prisma/client";

export type StandupQualityMetrics = {
  completion_rate: number;
  missing_linked_work_rate: number;
  missing_blockers_rate: number;
  vague_update_rate: number;
};

export type StandupQualityResult = {
  qualityScore: number;
  metrics: StandupQualityMetrics;
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const toRate = (hits: number, total: number) => {
  if (total <= 0) return 0;
  return (hits / total) * 100;
};

const isVagueText = (value: string | null | undefined) => {
  const text = value?.trim().toLowerCase();

  if (!text) return true;

  if (text.length < 25) return true;

  const vagueKeywords = [
    "same",
    "as usual",
    "nothing",
    "n/a",
    "na",
    "todo",
    "tbd",
    "working on it",
    "stuff",
  ];

  return vagueKeywords.some((keyword) => text.includes(keyword));
};

type QualityInputEntry = Pick<DailyStandupEntry, "summaryToday" | "progressSinceYesterday" | "blockers" | "isComplete"> & {
  linkedWorkCount: number;
};

export const calculateStandupQuality = (
  entries: QualityInputEntry[],
  totalMembers: number
): StandupQualityResult => {
  const denominator = Math.max(totalMembers, entries.length, 1);

  const completionRate = toRate(entries.filter((entry) => entry.isComplete).length, denominator);
  const missingLinkedWorkRate = toRate(
    entries.filter((entry) => entry.linkedWorkCount === 0).length,
    denominator
  );
  const missingBlockersRate = toRate(
    entries.filter((entry) => !entry.blockers?.trim()).length,
    denominator
  );

  const vagueRate = toRate(
    entries.filter((entry) => {
      const combined = [entry.progressSinceYesterday, entry.summaryToday]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ");

      return isVagueText(combined);
    }).length,
    denominator
  );

  const qualityScore = clampPercentage(
    completionRate * 0.4 +
      (100 - missingLinkedWorkRate) * 0.25 +
      (100 - missingBlockersRate) * 0.15 +
      (100 - vagueRate) * 0.2
  );

  return {
    qualityScore: Math.round(qualityScore),
    metrics: {
      completion_rate: Math.round(completionRate),
      missing_linked_work_rate: Math.round(missingLinkedWorkRate),
      missing_blockers_rate: Math.round(missingBlockersRate),
      vague_update_rate: Math.round(vagueRate),
    },
  };
};
