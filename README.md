# Voetbal IQ

Frontend-only soccer-intelligence trainer for kids (Dutch, ages ~8+), inspired by
soccer.intelligym.com. No backend, no sign-in — progress lives in localStorage.

## Run locally

Any static file server from the repo root, e.g.:

```
python -m http.server 8000
# open http://localhost:8000
```

## Test

Headless smoke test (plays a full decision-drill session, checks console errors,
saves screenshots to `test/shots/`):

```
python test/smoketest.py   # needs playwright + chromium in %LOCALAPPDATA%\ms-playwright
```

## Structure

- `js/render/pitch.js` — canvas top-down pitch renderer (shared by drills)
- `js/render/anim.js` — run-animation tween helper
- `js/drills/runner.js` — shared drill loop (HUD, timer, scoring, level adapt)
- `js/drills/` — one spec per drill: `decision.js` (Kies de beste pas),
  `scanning.js` (Kijk om je heen), `anticipation.js` (Voorspel de pas),
  `memory.js` (Onthoud de posities)
- `js/engine/` — difficulty params (levels 1–10), scoring, session composer
  (one session = 4 drill blocks × 6 rounds, ~10 min)
- `js/store.js` — localStorage persistence (profile, levels, history, streaks)
- `js/i18n.js` — all UI strings (Dutch)

## Deploy

GitHub Pages (legacy branch-source: `main`, root) — redeploys automatically on
every push to `main`. Live at https://sanzharid.github.io/soccer-iq-trainer/
Note: Actions-based deploy is not possible (account locked for billing).
