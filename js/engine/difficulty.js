// Per-drill difficulty: level 1..10, params + adaptive adjustment.

export function decisionParams(level) {
  return {
    teammates: Math.min(4, 2 + Math.floor(level / 3)),       // pass options
    defenders: Math.min(6, 2 + Math.round(level * 0.5)),     // blue shirts
    timeLimitMs: Math.max(4000, 12000 - level * 800),
    margin: Math.max(0.10, 0.28 - level * 0.018),            // required openness gap
  };
}

// recent: array of { correct, fast } newest-last, for this drill.
// 3 fast+correct in a row -> up; 2 wrong in a row -> down.
export function adjustLevel(level, recent) {
  const last3 = recent.slice(-3);
  if (last3.length === 3 && last3.every(r => r.correct && r.fast)) {
    return Math.min(10, level + 1);
  }
  const last2 = recent.slice(-2);
  if (last2.length === 2 && last2.every(r => !r.correct)) {
    return Math.max(1, level - 1);
  }
  return level;
}
