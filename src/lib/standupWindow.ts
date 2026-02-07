export const parseDateOnly = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

export const parseTimeOnDate = (baseDate: Date, time: string): Date | null => {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number.parseInt(hoursStr ?? "", 10);
  const minutes = Number.parseInt(minutesStr ?? "", 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const result = new Date(baseDate);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

export const getPreviousStandupDate = (
  baseDate: Date,
  skipWeekends: boolean
): Date => {
  const previous = new Date(baseDate);
  previous.setDate(previous.getDate() - 1);

  if (!skipWeekends) {
    return previous;
  }

  while (previous.getDay() === 0 || previous.getDay() === 6) {
    previous.setDate(previous.getDate() - 1);
  }

  return previous;
};
