# Moth & Lantern

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/bsnpg/moth-lantern-stealth-v3/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/bsnpg/moth-lantern-stealth-v3/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

A dust-winged moth thief flutters through a sleeping lantern temple, stealing
light from lamp-priest guards to reach the moonlit window and escape. A
top-down stealth game in plain Canvas 2D — no libraries, no network, no build
step. Open `game/index.html` in desktop Chrome and play.

## How it plays

- **Hide in hard shadows.** Three lamp-priests patrol with 60° vision cones.
  Folding screens, stone lanterns and scroll stacks clip the cones into crisp
  wedge-shaped shadows — stand inside the dark wedge and you are genuinely
  unseen. Hiding is geometry, not a dice roll.
- **Wing Dust.** Light raises it, darkness drains it. There is no meter: you
  read it in the moth itself — wings flutter fast and stutter near light,
  droop as the dust climbs, and a pink trail lingers in the air.
- **Snuff-dash (Space).** Dash a puff of wing dust that extinguishes one
  lantern for 4 seconds and blooms a bubble of ink-darkness to cross open
  floor.
- **Swing the hanging lantern (E).** Nudge its chain so its cone sweeps in a
  slow arc — a timed window, marked by a glowing arc.
- **Escape.** Reach the moonlit window at the top-right, unseen.

A guard's bright core catches you at once; its dim fringe only raises
suspicion over ~1.5 s. A suspicious guard investigates, sweeps a wider cone,
then forgets after 4 s and resumes patrol.

## Controls

- WASD / arrows — move
- Space — snuff-dash (also starts the game)
- E — push the hanging lantern
- P — pause
- R — restart after being caught or escaping

## Files

- `game/index.html` — the page; `game/src/` holds the game, one file per job:
  `config.js` (tuning and palette), `random.js` (seeded RNG), `input.js`
  (keyboard), `world.js` (simulation and cone raycast), `render.js`
  (Canvas drawing), `shots.js` (the four staged screenshots), `main.js`
  (bootstrap and loop).
- `screenshots/` — the four staged shots: Setup, Snuff Gambit, Swing Puzzle,
  Escape Clutch.
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output and writes `dossier.json` with the vendored make.fun library.

Built for [make.fun](https://make.fun)'s best stealth game bounty
(`best-stealth-game-20261121-1759`). MIT licensed.
