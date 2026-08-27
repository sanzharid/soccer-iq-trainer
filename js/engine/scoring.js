// Points per round: correctness + speed bonus.
export const BASE_POINTS = 100;
export const MAX_TIME_BONUS = 100;

export function roundPoints(correct, rtMs, timeLimitMs) {
  if (!correct) return 0;
  const frac = Math.max(0, 1 - rtMs / timeLimitMs);
  return BASE_POINTS + Math.round(MAX_TIME_BONUS * frac);
}

export function stars(correct, total) {
  const ratio = total ? correct / total : 0;
  if (ratio >= 0.8) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}
