// "Kijk om je heen" — scene flashes briefly, then blanks; tap where the FREE
// teammate stood. Trains scanning / field vision.
import { T } from '../i18n.js';
import { TEAM_RED, TEAM_BLUE } from '../render/pitch.js';
import { scanningParams } from '../engine/difficulty.js';

const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Every red except one gets a tight marker (visible adjacency); the free
// player has no defender nearby. Makes the correct answer unambiguous.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeScene(params) {
  const players = [];
  for (let i = 0; i < params.players; i++) {
    let p, ok, guard = 0;
    do {
      p = { x: rand(0.15, 0.85), y: rand(0.15, 0.85), team: TEAM_RED, number: i + 2 };
      ok = players.every(q => dist(q, p) > 0.16);
    } while (!ok && ++guard < 50);
    players.push(p);
  }
  const freeIndex = Math.floor(Math.random() * players.length);
  const defenders = [];
  players.forEach((p, i) => {
    if (i === freeIndex) return;                       // the free one stays unmarked
    const a = rand(0, Math.PI * 2), d = rand(0.07, 0.11);  // tight marker
    defenders.push({
      x: clamp(p.x + Math.cos(a) * d, 0.06, 0.94),
      y: clamp(p.y + Math.sin(a) * d, 0.08, 0.92),
      team: TEAM_BLUE, number: null,
    });
  });
  // extra roaming defenders, never near the free player
  const free = players[freeIndex];
  let extra = params.defenders - defenders.length, guard = 0;
  while (extra > 0 && ++guard < 200) {
    const d = { x: rand(0.15, 0.85), y: rand(0.15, 0.85), team: TEAM_BLUE, number: null };
    if (dist(d, free) > 0.25) { defenders.push(d); extra--; }
  }
  return { players: [...players, ...defenders], freeIndex };
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
