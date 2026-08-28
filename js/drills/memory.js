// "Onthoud de posities" — a few red players show briefly, screen blanks,
// then: "Waar stond nummer X?" Tap the spot. Trains working memory.
import { T } from '../i18n.js';
import { TEAM_RED } from '../render/pitch.js';
import { memoryParams } from '../engine/difficulty.js';

const rand = (a, b) => a + Math.random() * (b - a);

const SHIRT_NUMBERS = [2, 4, 5, 7, 8, 9, 11];

function makeScene(params) {
  const players = [];
  const nums = [...SHIRT_NUMBERS].sort(() => Math.random() - 0.5);
  for (let i = 0; i < params.players; i++) {
    // keep players apart so positions are distinguishable
    let p, ok, guard = 0;
    do {
      p = { x: rand(0.12, 0.88), y: rand(0.15, 0.85), team: TEAM_RED, number: nums[i] };
      ok = players.every(q => Math.hypot(q.x - p.x, q.y - p.y) > 0.18);
    } while (!ok && ++guard < 50);
    players.push(p);
  }
  return players;
}

export const memorySpec = {
  id: 'memory',
  title: T.drillMemory,
  intro: T.memoryIntro,
  rounds: 6,
  paramsFor: memoryParams,

  startRound(api) {
    const players = makeScene(api.params);
    const queryIndex = Math.floor(Math.random() * players.length);
    const ctx = { players, queryIndex, accepting: false };
    api.pitch.draw({ players });
    const myRound = api.roundId();
    setTimeout(() => {
      if (api.roundId() !== myRound || ctx.answered) return;
      api.pitch.draw({ players: [] });            // blank pitch
      api.setFeedback(T.memoryQuestion(players[queryIndex].number));
      ctx.accepting = true;
      api.startTimer(api.params.timeLimitMs);
    }, api.params.flashMs);
    return ctx;
  },

  onTap(ctx, api, idx, x, y) {
    const target = ctx.players[ctx.queryIndex];
    return { correct: api.pitch.normDist(x, y, target.x, target.y) < api.params.tolerance };
  },

  reveal(ctx, api) {
    api.pitch.draw({ players: ctx.players, highlight: ctx.queryIndex });
  },
};
