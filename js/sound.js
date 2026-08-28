// WebAudio sound effects — no assets, tiny synthesized bleeps.
import { store } from './store.js';

let audio = null;

function ctx() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function tone(freq, start, dur, type = 'sine', gain = 0.15) {
  const a = ctx();
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + dur);
}

export const sound = {
  get on() { return store.soundOn; },
  toggle() { store.setSoundOn(!store.soundOn); return store.soundOn; },

  good() { if (this.on) { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.25); } },
  bad() { if (this.on) { tone(220, 0, 0.25, 'sawtooth', 0.08); } },
  whistle() { if (this.on) { tone(2093, 0, 0.35, 'square', 0.06); } },
  tick() { if (this.on) { tone(880, 0, 0.05, 'sine', 0.05); } },
};
