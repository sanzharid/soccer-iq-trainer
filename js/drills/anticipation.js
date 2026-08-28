// "Voorspel de pas" — players make runs for a few seconds, play freezes the
// moment before the pass; tap the teammate who will receive it.
import { T } from '../i18n.js';
import { TEAM_RED, TEAM_BLUE } from '../render/pitch.js';
import { animateScene } from '../render/anim.js';
import { anticipationParams } from '../engine/difficulty.js';

const rand = (a, b) => a + Math.random() * (b - a);

// One teammate makes a clear run into space toward goal (the target);
// the others make decoy runs (lateral / backward / into a defender's zone).
function makeMovers(params) {
  const carrier = {
    x: 0.35, y: rand(0.35, 0.65), team: TEAM_RED, number: 10, hasBall: true,
    dx: rand(0.03, 0.06), dy: rand(-0.02, 0.02),
  };
  const target = {
    x: rand(0.50, 0.60), y: rand(0.25, 0.75), team: TEAM_RED, number: 9,
    dx: rand(0.18, 0.28), dy: rand(-0.05, 0.05),   // burst toward goal
  };
  const runners = [target];
  for (let i = 1; i < params.teammates; i++) {
    // keep runners apart so each is tappable and distinguishable
    let r, ok, guard = 0;
    do {
      r = {
        x: rand(0.45, 0.65), y: rand(0.15, 0.85), team: TEAM_RED, number: 7 + i,
        dx: rand(-0.06, 0.06), dy: rand(-0.08, 0.08),  // static/lateral decoy
      };
      ok = runners.every(q => Math.hypot(q.x - r.x, q.y - r.y) > 0.15);
    } while (!ok && ++guard < 50);
    runners.push(r);
  }
  const defenders = [];
  for (let i = 0; i < params.defenders; i++) {
    // defenders drift toward decoys or hold position, never toward target's lane
    const decoy = runners[1 + (i % Math.max(1, runners.length - 1))] ?? target;
    defenders.push({
      x: rand(0.55, 0.80), y: rand(0.15, 0.85), team: TEAM_BLUE, number: null,
      dx: (decoy.x - 0.65) * 0.15, dy: (decoy.y - 0.5) * 0.15,
    });
  }
  return { movers: [carrier, ...runners, ...defenders], targetIndex: 1 };
}

export const anticipationSpec = {
  id: 'anticipation',
  title: T.drillAnticipation,
  intro: T.anticipationIntro,
  rounds: 6,
  paramsFor: anticipationParams,

  startRound(api) {
    const { movers, targetIndex } = makeMovers(api.params);
    const ctx = { movers, targetIndex, accepting: false };
    const myRound = api.roundId();
    animateScene(api.pitch, movers, api.params.animMs, () => {
      if (api.roundId() !== myRound || ctx.answered) return;
      // freeze frame: final positions, carrier highlighted
      ctx.final = {
        players: movers.map(m => ({ ...m, x: m.x + m.dx, y: m.y + m.dy })),
        highlight: 0,
      };
      api.pitch.draw(ctx.final);
      api.setFeedback(T.anticipationQuestion);
      ctx.accepting = true;
      api.startTimer(api.params.timeLimitMs);
    });
    return ctx;
  },

  onTap(ctx, api, idx) {
    const optionIndices = ctx.movers.map((m, i) => i).filter(i => i > 0 && ctx.movers[i].team === TEAM_RED);
    if (!optionIndices.includes(idx)) return null;
    return { correct: idx === ctx.targetIndex };
  },

  reveal(ctx, api) {
    if (ctx.final) api.pitch.draw({ ...ctx.final, highlight: ctx.targetIndex });
  },
};
