// localStorage persistence: profile, per-drill levels, session history.
const KEY = 'voetbal-iq-v1';

const DEFAULTS = {
  profile: null,          // { name: string }
  levels: {},             // drillId -> 1..10
  history: [],            // { ts, drillId, level, correct, rtMs }
  sessions: [],           // { ts, points, rounds, correct }
  streakDays: 0,
  lastSessionDay: null,   // 'YYYY-MM-DD' local
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let state = load();

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function dayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const store = {
  get profile() { return state.profile; },
  setProfile(name) {
    state.profile = { name };
    save();
  },

  getLevel(drillId) { return state.levels[drillId] ?? 1; },
  setLevel(drillId, level) {
    state.levels[drillId] = Math.max(1, Math.min(10, level));
    save();
  },

  recordRound(drillId, level, correct, rtMs) {
    state.history.push({ ts: Date.now(), drillId, level, correct, rtMs });
    save();
  },

  recordSession(points, rounds, correct) {
    state.sessions.push({ ts: Date.now(), points, rounds, correct });
    const today = dayStr();
    if (state.lastSessionDay !== today) {
      const yesterday = dayStr(new Date(Date.now() - 86400000));
      state.streakDays = (state.lastSessionDay === yesterday) ? state.streakDays + 1 : 1;
      state.lastSessionDay = today;
    }
    save();
  },

  get streak() { return state.streakDays; },
  get totalSessions() { return state.sessions.length; },
  recentHistory(n = 50) { return state.history.slice(-n); },

  get soundOn() { return state.soundOn !== false; },   // default on
  setSoundOn(v) { state.soundOn = !!v; save(); },
};
