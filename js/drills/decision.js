// "Kies de beste pas" — frozen attack scenario, tap the most open teammate.
import { T } from '../i18n.js';
import { TEAM_RED, TEAM_BLUE } from '../render/pitch.js';
import { decisionParams } from '../engine/difficulty.js';

const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Build a scenario with a unique best option (openness gap >= margin).
function makeScenario(params) {
  for (let tries = 0; tries < 200; tries++) {
    const carrier = { x: rand(0.30, 0.45), y: rand(0.3, 0.7), team: TEAM_RED, number: 10, hasBall: true };
    const options = [];
    for (let i = 0; i < params.teammates; i++) {
      options.push({
        x: rand(0.55, 0.85), y: 0.15 + (0.7 * (i + rand(0.1, 0.9))) / params.teammates,
        team: TEAM_RED, number: 7 + i,
      });
    }
    const defenders = [];
    for (let i = 0; i < params.defenders; i++) {
      // bias defenders toward the attacking half so marking is visible
      defenders.push({ x: rand(0.45, 0.92), y: rand(0.1, 0.9), team: TEAM_BLUE, number: null });
    }
    // score options: min defender distance + small forwardness bonus
    const scored = options.map(o => {
      const nearest = Math.min(...defenders.map(d => dist(o, d)));
      return { o, score: nearest + (o.x - 0.55) * 0.25 };
    }).sort((a, b) => b.score - a.score);
    if (scored.length < 2 || scored[0].score - scored[1].score >= params.margin) {
      return {
        players: [carrier, ...options, ...defenders],
        optionIndices: options.map((_, i) => i + 1),
        correctIndex: 1 + options.indexOf(scored[0].o),
      };
    }
  }
  // fallback: deterministic easy scenario (one clearly free far-forward option)
  const carrier = { x: 0.38, y: 0.5, team: TEAM_RED, number: 10, hasBall: true };
  const options = [
    { x: 0.80, y: 0.5, team: TEAM_RED, number: 7 },   // free, forward
    { x: 0.58, y: 0.2, team: TEAM_RED, number: 8 },
  ];
  const defenders = [
    { x: 0.60, y: 0.24, team: TEAM_BLUE, number: null }, // tight on option 2
    { x: 0.62, y: 0.75, team: TEAM_BLUE, number: null },
  ];
  return {
    players: [carrier, ...options, ...defenders],
    optionIndices: [1, 2],
    correctIndex: 1,
  };
}

export const decisionSpec = {
  id: 'decision',
  title: T.drillDecision,
  intro: T.drillDecisionIntro,
  rounds: 8,
  paramsFor: decisionParams,

  startRound(api) {
    const scenario = makeScenario(api.params);
    api.pitch.draw(scenario);
    api.startTimer(api.params.timeLimitMs);
    return scenario;
  },

  onTap(ctx, api, idx) {
    if (!ctx.optionIndices.includes(idx)) return null;
    return { correct: idx === ctx.correctIndex };
  },

  reveal(ctx, api) {
    api.pitch.draw({ ...ctx, highlight: ctx.correctIndex });
  },
};
