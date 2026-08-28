// Shared drill runner: HUD, round loop, timer bar, feedback, scoring, level
// adaptation. A drill is a "spec" object — see decision.js for an example.
//
// spec = {
//   id, title, intro,          // strings shown in HUD/feedback
//   rounds,                    // default rounds per playthrough
//   paramsFor(level),          // difficulty params for level 1..10
//   startRound(api) -> ctx,    // draw scene, schedule phases; ctx flows to onTap/reveal
//   onTap(ctx, api, idx, x, y) -> null | { correct, msg? },
//   reveal(ctx, api),          // optional: highlight the right answer after a round
// }
//
// api = { pitch, params, level, setFeedback, startTimer, submit, roundId }
// - Drills with a flash/animation phase set ctx.accepting = false until the
//   answer phase begins, then call api.startTimer(limitMs).
// - Scheduled phase changes must bail out when api.roundId() changed.
import { T } from '../i18n.js';
import { Pitch } from '../render/pitch.js';
import { adjustLevel } from '../engine/difficulty.js';
import { roundPoints, stars } from '../engine/scoring.js';
import { store } from '../store.js';
import { sound } from '../sound.js';

export function runDrill(app, spec, onDone, options = {}) {
  const level = store.getLevel(spec.id);
  const params = spec.paramsFor(level);
  const rounds = options.rounds ?? spec.rounds;

  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="hud">
      <span>${spec.title} · ${T.level(level)}</span>
      <span data-round></span>
      <span data-points>${T.points(0)}</span>
    </div>
    <div class="timerbar"><div data-timer style="width:100%"></div></div>
    <div class="pitch-wrap"><canvas></canvas></div>
    <div class="feedback" data-feedback>${spec.intro}</div>
  `;
  app.replaceChildren(screen);

  const canvas = screen.querySelector('canvas');
  const pitch = new Pitch(canvas);
  const roundEl = screen.querySelector('[data-round]');
  const pointsEl = screen.querySelector('[data-points]');
  const timerEl = screen.querySelector('[data-timer]');
  const feedbackEl = screen.querySelector('[data-feedback]');

  const state = {
    round: 0, points: 0, correct: 0,
    results: [],
    ctx: null,
    accepting: false,
    roundStart: 0,
    timerLimit: 0,
    timerId: null,
  };

  function setFeedback(msg, cls) {
    feedbackEl.textContent = msg;
    feedbackEl.className = 'feedback' + (cls ? ' ' + cls : '');
  }

  function submit(result) {
    if (!state.accepting) return;
    state.accepting = false;
    clearInterval(state.timerId);
    if (state.ctx) state.ctx.answered = true;

    const rtMs = state.timerLimit ? performance.now() - state.roundStart : 0;
    const correct = !!result.correct;
    const fast = correct && state.timerLimit > 0 && rtMs < state.timerLimit * 0.6;
    state.results.push({ correct, fast });
    if (correct) {
      state.correct++;
      state.points += roundPoints(true, rtMs, state.timerLimit || 10000);
    }
    store.recordRound(spec.id, level, correct, Math.round(rtMs));
    pointsEl.textContent = T.points(state.points);

    const msg = result.msg ?? (correct ? T.correct : T.wrong);
    setFeedback(msg, correct ? 'good' : 'bad');
    if (correct) sound.good(); else sound.bad();
    if (spec.reveal && state.ctx) spec.reveal(state.ctx, api);

    setTimeout(() => {
      if (state.round >= rounds) finish();
      else startRound();
    }, 1400);
  }

  function startTimer(limitMs) {
    state.timerLimit = limitMs;
    state.roundStart = performance.now();
    clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      const left = 1 - (performance.now() - state.roundStart) / limitMs;
      timerEl.style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) submit({ correct: false, msg: T.tooSlow });
    }, 100);
  }

  function startRound() {
    state.round++;
    state.timerLimit = 0;
    timerEl.style.width = '100%';
    roundEl.textContent = T.round(state.round, rounds);
    setFeedback(spec.intro);
    state.accepting = true;
    state.ctx = spec.startRound(api);
  }

  function finish() {
    pitch.onTap = null;
    clearInterval(state.timerId);
    const newLevel = adjustLevel(level, state.results);
    store.setLevel(spec.id, newLevel);
    if (options.recordSession !== false) {
      store.recordSession(state.points, state.round, state.correct);
    }
    onDone({
      drillId: spec.id,
      points: state.points,
      correct: state.correct,
      rounds: state.round,
      stars: stars(state.correct, state.round),
      levelBefore: level,
      levelAfter: newLevel,
    });
  }

  const api = {
    pitch, params, level,
    setFeedback, startTimer, submit,
    roundId: () => state.round,
  };

  pitch.resize();
  pitch.onTap = (idx, x, y) => {
    if (!state.accepting || !state.ctx) return;
    if (state.ctx.accepting === false) return;
    const r = spec.onTap(state.ctx, api, idx, x, y);
    if (r) submit(r);
  };
  startRound();

  return {
    get id() { return spec.id; },
    get state() { return state; },
    get ctx() { return state.ctx; },
    answerCorrect: () => {
      if (!state.ctx || state.ctx.accepting === false) return; // same gate as real taps
      submit({ correct: true });
    },
    answerWrong: () => {
      if (!state.ctx || state.ctx.accepting === false) return;
      submit({ correct: false });
    },
  };
}
