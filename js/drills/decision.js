// "Kies de beste pas" — frozen attack scenario, tap the most open teammate.
import { T } from '../i18n.js';
import { Pitch, TEAM_RED, TEAM_BLUE } from '../render/pitch.js';
import { decisionParams, adjustLevel } from '../engine/difficulty.js';
import { roundPoints, stars } from '../engine/scoring.js';
import { store } from '../store.js';

const DRILL_ID = 'decision';
const ROUNDS = 8;

const rand = (a, b) => a + Math.random() * (b - a);

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

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

export function runDecisionDrill(app, onDone) {
  const level = store.getLevel(DRILL_ID);
  const params = decisionParams(level);

  const screen = document.createElement('div');
  screen.className = 'screen';
  screen.innerHTML = `
    <div class="hud">
      <span>${T.drillDecision} · ${T.level(level)}</span>
      <span data-round></span>
      <span data-points>${T.points(0)}</span>
    </div>
    <div class="timerbar"><div data-timer style="width:100%"></div></div>
    <div class="pitch-wrap"><canvas></canvas></div>
    <div class="feedback" data-feedback>${T.drillDecisionIntro}</div>
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
    results: [],       // { correct, fast }
    scenario: null,
    accepting: false,
    roundStart: 0,
    timerId: null,
  };

  function setFeedback(msg, cls) {
    feedbackEl.textContent = msg;
    feedbackEl.className = 'feedback' + (cls ? ' ' + cls : '');
  }

  function startRound() {
    state.round++;
    state.scenario = makeScenario(params);
    state.accepting = true;
    state.roundStart = performance.now();
    roundEl.textContent = T.round(state.round, ROUNDS);
    pitch.draw(state.scenario);
    setFeedback(T.drillDecisionIntro);

    const t0 = state.roundStart;
    clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      const left = 1 - (performance.now() - t0) / params.timeLimitMs;
      timerEl.style.width = Math.max(0, left * 100) + '%';
      if (left <= 0) endRound(-1);
    }, 100);
  }

  function endRound(chosenIndex) {
    if (!state.accepting) return;
    state.accepting = false;
    clearInterval(state.timerId);

    const rtMs = performance.now() - state.roundStart;
    const correct = chosenIndex === state.scenario.correctIndex;
    const fast = correct && rtMs < params.timeLimitMs * 0.6;
    state.results.push({ correct, fast });
    if (correct) {
      state.correct++;
      state.points += roundPoints(true, rtMs, params.timeLimitMs);
    }
    store.recordRound(DRILL_ID, level, correct, Math.round(rtMs));
    pointsEl.textContent = T.points(state.points);

    const msg = chosenIndex === -1 ? T.tooSlow : (correct ? T.correct : T.wrong);
    setFeedback(msg, correct ? 'good' : 'bad');
    pitch.draw({ ...state.scenario, highlight: state.scenario.correctIndex });

    setTimeout(() => {
      if (state.round >= ROUNDS) finish();
      else startRound();
    }, 1400);
  }

  function finish() {
    pitch.onTap = null;
    const newLevel = adjustLevel(level, state.results);
    store.setLevel(DRILL_ID, newLevel);
    store.recordSession(state.points, ROUNDS, state.correct);
    onDone({
      drillId: DRILL_ID,
      points: state.points,
      correct: state.correct,
      rounds: ROUNDS,
      stars: stars(state.correct, ROUNDS),
      levelBefore: level,
      levelAfter: newLevel,
    });
  }

  pitch.resize();
  pitch.onTap = (idx) => {
    if (!state.accepting) return;
    if (state.scenario.optionIndices.includes(idx)) endRound(idx);
  };
  startRound();

  // test hooks
  return {
    get state() { return state; },
    get scenario() { return state.scenario; },
    answerCorrect() { endRound(state.scenario.correctIndex); },
    answerWrong() {
      const wrong = state.scenario.optionIndices.find(i => i !== state.scenario.correctIndex);
      endRound(wrong);
    },
  };
}
