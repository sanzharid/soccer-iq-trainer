// Session composer: runs every drill once as a block (~10 min total),
// records ONE session in the store at the end.
import { runDrill } from '../drills/runner.js';
import { decisionSpec } from '../drills/decision.js';
import { scanningSpec } from '../drills/scanning.js';
import { anticipationSpec } from '../drills/anticipation.js';
import { memorySpec } from '../drills/memory.js';
import { stars } from '../engine/scoring.js';
import { store } from '../store.js';
import { sound } from '../sound.js';

export const DRILLS = [decisionSpec, scanningSpec, anticipationSpec, memorySpec];
export const DRILLS_BY_ID = Object.fromEntries(DRILLS.map(d => [d.id, d]));

const SESSION_ROUNDS = 6;

export function runSession(app, onDone, onDrillStart, onQuit) {
  sound.whistle();
  const queue = [...DRILLS];
  const totals = { points: 0, correct: 0, rounds: 0 };
  let quit = false;

  function next() {
    const spec = queue.shift();
    if (!spec || quit) {
      if (quit) { if (onQuit) onQuit(); return; }
      store.recordSession(totals.points, totals.rounds, totals.correct);
      onDone({
        session: true,
        points: totals.points,
        correct: totals.correct,
        rounds: totals.rounds,
        stars: stars(totals.correct, totals.rounds),
      });
      return;
    }
    const handle = runDrill(app, spec, (summary) => {
      if (quit) return;
      totals.points += summary.points;
      totals.correct += summary.correct;
      totals.rounds += summary.rounds;
      next();
    }, {
      rounds: SESSION_ROUNDS,
      recordSession: false,
      onQuit: () => { quit = true; if (onQuit) onQuit(); },
    });
    if (onDrillStart) onDrillStart(handle);
  }

  next();
}