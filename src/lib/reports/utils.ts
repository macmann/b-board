export const median = (numbers: number[]) => {
  if (!numbers.length) return null;

  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
};

export const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

export const daysBetween = (a: Date, b: Date) => {
  const diffMs = b.getTime() - a.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
};
