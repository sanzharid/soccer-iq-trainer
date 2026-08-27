// App shell: screen router (name entry / home / drill / result) + test hooks.
import { T } from './i18n.js';
import { store } from './store.js';
import { runDecisionDrill } from './drills/decision.js';

const app = document.getElementById('app');
let currentScreen = 'boot';
let drillHandle = null;

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

function showNameScreen() {
  currentScreen = 'name';
  const s = el(`
    <div class="screen">
      <h1>⚽ ${T.appTitle}</h1>
      <div class="card">
        <h2 style="color:var(--ink)">${T.askName}</h2>
        <input type="text" maxlength="20" placeholder="${T.namePlaceholder}" autocomplete="off">
        <button>${T.letsGo}</button>
      </div>
    </div>`);
  const input = s.querySelector('input');
  const go = () => {
    const name = input.value.trim();
    if (name) { store.setProfile(name); showHome(); }
    else input.focus();
  };
  s.querySelector('button').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  app.replaceChildren(s);
  input.focus();
}

function showHome() {
  currentScreen = 'home';
  const name = store.profile.name;
  const streak = store.streak;
  const level = store.getLevel('decision');
  const s = el(`
    <div class="screen">
      <h1>⚽ ${T.appTitle}</h1>
      <div class="card">
        <h2 style="color:var(--ink)">${T.welcomeBack(name)}</h2>
        ${streak > 0 ? `<div class="badge">🔥 ${T.streak(streak)}</div>` : ''}
        <div class="badge">⭐ ${T.level(level)}</div>
        <button data-start>${T.start}</button>
      </div>
    </div>`);
  s.querySelector('[data-start]').addEventListener('click', showDrill);
  app.replaceChildren(s);
}

function showDrill() {
  currentScreen = 'drill';
  drillHandle = runDecisionDrill(app, showResult);
}

function showResult(summary) {
  currentScreen = 'result';
  drillHandle = null;
  const name = store.profile.name;
  const s = el(`
    <div class="screen">
      <h1>${T.sessionDone}</h1>
      <div class="card">
        <div class="stars">${'⭐'.repeat(summary.stars)}</div>
        <h2 style="color:var(--ink)">${T.wellDone(name)}</h2>
        <div class="badge">${T.points(summary.points)}</div>
        <div>${summary.correct} / ${summary.rounds} ✓ · ${T.level(summary.levelAfter)}</div>
        <p>${T.restDay}</p>
        <button data-again class="secondary">${T.playAgain}</button>
        <button data-home>${T.backHome}</button>
      </div>
    </div>`);
  s.querySelector('[data-again]').addEventListener('click', showDrill);
  s.querySelector('[data-home]').addEventListener('click', showHome);
  app.replaceChildren(s);
}

// Headless test hooks (used by test/smoketest.py)
window.__test = {
  screen: () => currentScreen,
  setProfile: (name) => { store.setProfile(name); showHome(); },
  startDrill: () => showDrill(),
  scenario: () => drillHandle?.scenario ?? null,
  answerCorrect: () => drillHandle?.answerCorrect(),
  answerWrong: () => drillHandle?.answerWrong(),
  drillState: () => drillHandle ? {
    round: drillHandle.state.round,
    points: drillHandle.state.points,
    correct: drillHandle.state.correct,
  } : null,
  store: () => JSON.parse(localStorage.getItem('voetbal-iq-v1')),
};

// boot
if (store.profile) showHome();
else showNameScreen();
