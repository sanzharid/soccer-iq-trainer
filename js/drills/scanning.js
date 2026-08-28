// "Kijk om je heen" — scene flashes briefly, then blanks; tap where the FREE
// teammate stood. Trains scanning / field vision.
import { T } from '../i18n.js';
import { TEAM_RED, TEAM_BLUE } from '../render/pitch.js';
import { scanningParams } from '../engine/difficulty.js';

const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function makeScene(params) {
  for (let tries = 0; tries < 100; tries++) {
    const players = [];
    for (let i = 0; i < params.players; i++) {
      players.push({ x: rand(0.15, 0.85), y: rand(0.15, 0.85), team: TEAM_RED, number: i + 2 });
    }
    const defenders = [];
    for (let i = 0; i < params.defenders; i++) {
      defenders.push({ x: rand(0.15, 0.85), y: rand(0.15, 0.85), team: TEAM_BLUE, number: null });
    }
    // free player = red with the most space; must be clearly freer than the rest
    const scored = players.map(p => ({
      p, space: Math.min(...defenders.map(d => dist(p, d))),
    })).sort((a, b) => b.space - a.space);
    if (scored.length < 2 || scored[0].space - scored[1].space >= 0.10) {
      return {
        players: [...players, ...defenders],
        freeIndex: players.indexOf(scored[0].p),
      };
    }
  }
  // fallback: one obviously free red on the right wing, one marked
  return {
    players: [
      { x: 0.80, y: 0.5, team: TEAM_RED, number: 2 },
      { x: 0.35, y: 0.35, team: TEAM_RED, number: 3 },
      { x: 0.33, y: 0.40, team: TEAM_BLUE, number: null },
    ],
    freeIndex: 0,
  };
}

export const scanningSpec = {
  id: 'scanning',
  title: T.drillScanning,
  intro: T.scanningIntro,
  rounds: 6,
  paramsFor: scanningParams,

  startRound(api) {
    const scene = makeScene(api.params);
    const ctx = { ...scene, accepting: false };
    api.pitch.draw(scene);
    const myRound = api.roundId();
    setTimeout(() => {
      if (api.roundId() !== myRound || ctx.answered) return;
      api.pitch.draw({ players: [] });           // blank pitch
      api.setFeedback(T.scanningQuestion);
      ctx.accepting = true;
      api.startTimer(api.params.timeLimitMs);
    }, api.params.flashMs);
    return ctx;
  },

  onTap(ctx, api, idx, x, y) {
    const free = ctx.players[ctx.freeIndex];
    return { correct: api.pitch.normDist(x, y, free.x, free.y) < api.params.tolerance };
  },

  reveal(ctx, api) {
    api.pitch.draw({ players: ctx.players, highlight: ctx.freeIndex });
  },
};
