// Per-drill difficulty: level 1..10, params + adaptive adjustment.

export function decisionParams(level) {
  return {
    teammates: Math.min(4, 2 + Math.floor(level / 3)),       // pass options
    defenders: Math.min(6, 2 + Math.round(level * 0.5)),     // blue shirts
    timeLimitMs: Math.max(4000, 12000 - level * 800),
    margin: Math.max(0.10, 0.28 - level * 0.018),            // required openness gap
  };
}

export function scanningParams(level) {
  return {
    players: Math.min(7, 3 + Math.floor(level / 2)),          // red shirts in scene
    defenders: Math.min(8, 2 + level),                        // >= players-1: every red but one gets a marker
    flashMs: Math.max(1500, 4000 - level * 250),              // scene visible time
    timeLimitMs: Math.max(5000, 12000 - level * 600),
    tolerance: Math.max(0.10, 0.16 - level * 0.005),          // tap distance allowed
  };
}

export function anticipationParams(level) {
  return {
    teammates: Math.min(4, 2 + Math.floor(level / 3)),        // runners
    defenders: Math.min(3, Math.floor(level / 2)),
    animMs: Math.max(1200, 2200 - level * 100),               // run animation time
    timeLimitMs: Math.max(5000, 12000 - level * 600),
  };
}

export function memoryParams(level) {
  return {
    players: Math.min(5, 3 + Math.floor(level / 3)),
    flashMs: Math.max(1800, 4000 - level * 220),
    timeLimitMs: Math.max(6000, 12000 - level * 500),
    tolerance: Math.max(0.09, 0.16 - level * 0.006),
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
