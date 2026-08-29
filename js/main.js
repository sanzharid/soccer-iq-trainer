// App shell: screen router (name entry / home / drill / result) + test hooks.
import { T } from './i18n.js';
import { store } from './store.js';
import { runDrill } from './drills/runner.js';
import { runSession, DRILLS, DRILLS_BY_ID } from './engine/session.js';
import { sound } from './sound.js';

const app = document.getElementById('app');
let currentScreen = 'boot';
let drillHandle = null;
let lastAction = null; // for "Nog een keer"

function el(html) {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
}

// Parent info overlay (uitleg + install instructies), available on name/home screens.
const infoOverlay = el(`
  <div class="info-overlay" data-info-overlay hidden>
    <div class="card info-card">
      <h2 style="color:var(--ink)">${T.infoTitle}</h2>
      <h3>${T.infoWhatTitle}</h3>
      <p>${T.infoWhat}</p>
      <h3>${T.infoInstallTitle}</h3>
      <p>${T.infoIos}</p>
      <p>${T.infoAndroid}</p>
      <p>${T.infoLaptop}</p>
      <p style="opacity:.7">${T.infoNote}</p>
      <button data-info-close>${T.close}</button>
    </div>
  </div>`);
document.body.appendChild(infoOverlay);
infoOverlay.querySelector('[data-info-close]').addEventListener('click', () => { infoOverlay.hidden = true; });
infoOverlay.addEventListener('click', (e) => { if (e.target === infoOverlay) infoOverlay.hidden = true; });

// Mobile zoom lockdown: block pinch zoom and double-tap zoom so the pitch
// never escapes the app frame.
let lastTouch = { t: 0, x: 0, y: 0 };
function allowTouch(el) {
  // Let the scrolling info card and form inputs behave normally.
  return el.closest('.info-card') || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}
document.addEventListener('touchstart', (e) => {
  if (allowTouch(e.target)) return;
  if (e.touches.length > 1) {
    e.preventDefault();                 // pinch zoom
  } else {
    const t = e.touches[0];
    const now = Date.now();
    const dt = now - lastTouch.t;
    const dx = Math.abs(t.clientX - lastTouch.x);
    const dy = Math.abs(t.clientY - lastTouch.y);
    if (dt < 350 && dx < 40 && dy < 40) {
      e.preventDefault();               // double-tap zoom
    }
    lastTouch = { t: now, x: t.clientX, y: t.clientY };
  }
}, { passive: false, capture: true });
// legacy iOS pinch
window.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('gesturechange', (e) => e.preventDefault());
window.addEventListener('gestureend', (e) => e.preventDefault());

const INFO_BTN = `<button data-info class="info-btn">${T.infoBtn}</button>`;
function wireInfo(s) {
  s.querySelectorAll('[data-info]').forEach(b =>
    b.addEventListener('click', () => { infoOverlay.hidden = false; }));
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
        ${INFO_BTN}
      </div>
    </div>`);
  wireInfo(s);
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
  const badges = DRILLS.map(d =>
    `<div class="badge">${d.title}: ${T.level(store.getLevel(d.id))}</div>`).join('');
  const s = el(`
    <div class="screen">
      <h1>⚽ ${T.appTitle}</h1>
      <div class="card">
        <h2 style="color:var(--ink)">${T.welcomeBack(name)}</h2>
        ${streak > 0 ? `<div class="badge">🔥 ${T.streak(streak)}</div>` : ''}
        <div class="badge">🏅 ${T.sessionsCount(store.totalSessions)}</div>
        <button data-start>${T.start}</button>
        <p style="color:var(--ink);opacity:.7">${T.chooseDrill}</p>
        <div class="drill-picker">
          ${DRILLS.map(d => `<button class="secondary" data-drill="${d.id}">${d.title}</button>`).join('')}
        </div>
        <div class="levels">${badges}</div>
        <button data-sound class="sound-toggle">${store.soundOn ? '🔊' : '🔇'}</button>
        ${INFO_BTN}
      </div>
    </div>`);
  wireInfo(s);
  s.querySelector('[data-start]').addEventListener('click', startSession);
  s.querySelectorAll('[data-drill]').forEach(b =>
    b.addEventListener('click', () => startDrill(b.dataset.drill)));
  const soundBtn = s.querySelector('[data-sound]');
  soundBtn.addEventListener('click', () => {
    const on = sound.toggle();
    soundBtn.textContent = on ? '🔊' : '🔇';
    if (on) sound.tick();
  });
  app.replaceChildren(s);
}

function startSession() {
  lastAction = startSession;
  currentScreen = 'drill';
  drillHandle = null;
  runSession(app, showResult, (h) => { drillHandle = h; }, showHome);
}

function startDrill(id) {
  lastAction = () => startDrill(id);
  currentScreen = 'drill';
  drillHandle = runDrill(app, DRILLS_BY_ID[id], showResult, { onQuit: showHome });
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
        <div>${summary.correct} / ${summary.rounds} ✓${summary.levelAfter ? ' · ' + T.level(summary.levelAfter) : ''}</div>
        <p>${T.restDay}</p>
        <button data-again class="secondary">${T.playAgain}</button>
        <button data-home>${T.backHome}</button>
      </div>
    </div>`);
  s.querySelector('[data-again]').addEventListener('click', () => (lastAction ?? showHome)());
  s.querySelector('[data-home]').addEventListener('click', showHome);
  app.replaceChildren(s);
}

// Headless test hooks (used by test/smoketest.py)
window.__test = {
  screen: () => currentScreen,
  setProfile: (name) => {
    name = (name ?? '').trim();
    if (name) { store.setProfile(name); showHome(); }
  },
  startDrill: (id = 'decision', rounds) => {
    lastAction = () => startDrill(id);
    currentScreen = 'drill';
    drillHandle = runDrill(app, DRILLS_BY_ID[id], showResult,
      { rounds, onQuit: showHome });
  },
  startSession: () => startSession(),
  quit: () => drillHandle?.quit(),
  scenario: () => drillHandle?.ctx ?? null,
  answerCorrect: () => drillHandle?.answerCorrect(),
  answerWrong: () => drillHandle?.answerWrong(),
  drillState: () => drillHandle ? {
    drill: drillHandle.id,
    round: drillHandle.state.round,
    points: drillHandle.state.points,
    correct: drillHandle.state.correct,
    accepting: !!drillHandle.ctx && drillHandle.ctx.accepting !== false,
  } : null,
  store: () => JSON.parse(localStorage.getItem('voetbal-iq-v1')),
};

// boot
if (store.profile) showHome();
else showNameScreen();
