// Moth & Lantern — screenshot staging.
//
// The four shots the judge sees, each staged as one frozen frame with a
// single element that pops. A shot is pure state: positions, facings,
// suspicion and dust are set directly, the cones are rebuilt from them, and
// the world never advances, so the frame is identical every time it is
// taken. ?shot=setup|snuff|swing|escape&seed=N in the URL picks one.

import { refreshCones } from './world.js';

export const SHOT_NAMES = ['setup', 'snuff', 'swing', 'escape'];

export function readShotFromUrl(search) {
  const params = new URLSearchParams(search || '');
  const shot = params.get('shot');
  const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
  return { shot: SHOT_NAMES.includes(shot) ? shot : null, seed };
}

function placeGuard(world, index, x, y, facing, mode, suspicion) {
  const guard = world.guards[index];
  guard.x = x;
  guard.y = y;
  guard.facing = facing;
  guard.mode = mode || 'patrol';
  guard.suspicion = suspicion || 0;
  guard.pauseLeft = 0;
  guard.investigateLeft = mode === 'investigate' ? 4 : 0;
  guard.lastSeen = mode === 'investigate' ? { x: 1160, y: 80 } : null;
  return guard;
}

function setMoth(world, x, y, facing, dust, scale) {
  const moth = world.moth;
  moth.x = x;
  moth.y = y;
  moth.facing = facing;
  moth.dust = dust;
  moth.flutter = 1.2;
  moth.droop = dust * 0.5;
  moth.twitch = 0.5;
  moth.dashLeft = 0;
  moth.snuffCooldown = 0;
  moth.moving = false;
  world.shotMothScale = scale || 1;
  world.motes = [];
}

function addMotes(world, x, y, count, spread) {
  for (let i = 0; i < count; i++) {
    world.motes.push({
      x: x - i * spread - 8,
      y: y + (i % 2 === 0 ? -6 : 7),
      age: 0.2 + i * 0.08,
      life: 1.4,
      drift: Math.PI,
    });
  }
}

// 1. The Heist Setup — wide courtyard, moth bottom-left, exit glowing
// top-right, three cones clipping the lantern shadows, moth dim. The title
// panel is compact and top-left, so the centre cones stay visible.
function stageSetup(world) {
  world.state = 'title';
  world.time = 5;
  world.displayTime = 5;
  setMoth(world, 122, 618, -Math.PI / 2, 0.15, 1);
  // Ash looks down-right across the courtyard: a cone aimed straight right
  // would die on the folding screen in front of him.
  placeGuard(world, 0, 470, 300, 0.5, 'patrol', 0);
  placeGuard(world, 1, 200, 180, Math.PI / 2, 'patrol', 0);
  placeGuard(world, 2, 1050, 200, Math.PI / 2, 'patrol', 0);
  world.swing.angle = 0.12;
  world.swing.velocity = 0;
  world.swing.x = 1080 + 92 * Math.sin(0.12);
  world.swing.y = 116 + 92 * Math.cos(0.12);
}

// 2. The Snuff Gambit — moth mid-dash with a dust trail, the left lantern
// gutted with black ink spreading, Ember's cone half-cut by the dark.
function stageSnuff(world) {
  world.state = 'play';
  world.time = 0;
  world.displayTime = 0;
  // The moth is deep inside the ink, not on its edge.
  setMoth(world, 130, 445, -0.5, 0.55, 1);
  world.moth.dashLeft = 0.1;
  world.moth.dashDir = { x: 0.8, y: -0.6 };
  addMotes(world, 130, 445, 6, 12);
  // The left lantern is snuffed: dark, with its ink bubble bloomed.
  const lantern = world.lanterns[3];
  lantern.outUntil = 4;
  world.bubbles.push({ x: lantern.x, y: lantern.y, born: -0.5, until: 4.5 });
  // Ember, close by, has caught a glimpse: suspicion rising, "?" up.
  placeGuard(world, 0, 470, 300, 0.5, 'patrol', 0);
  placeGuard(world, 1, 200, 292, 1.05, 'patrol', 0.7);
  placeGuard(world, 2, 1050, 200, Math.PI / 2, 'patrol', 0);
  world.swing.angle = -0.2;
  world.swing.velocity = 0;
  world.swing.x = 1080 + 92 * Math.sin(-0.2);
  world.swing.y = 116 + 92 * Math.cos(-0.2);
}

// 3. The Swing Puzzle — narrow screen corridor, chain swaying with its
// glowing arc, the moth LARGE and peeking from behind the screen.
function stageSwing(world) {
  world.state = 'play';
  world.time = 0;
  world.displayTime = 0;
  // 1.4x moth, right of the corridor screens, impossible to miss.
  setMoth(world, 895, 400, Math.PI / 2, 0.4, 1.4);
  addMotes(world, 895, 400, 5, 12);
  placeGuard(world, 0, 470, 300, 0.6, 'patrol', 0);
  placeGuard(world, 1, 200, 180, Math.PI / 2, 'patrol', 0);
  // Cinder patrols the corridor; her cone sweeps the screens.
  placeGuard(world, 2, 1050, 420, Math.PI, 'patrol', 0);
  // The chain is mid-swing, lantern out to one side.
  world.swing.angle = 0.38;
  world.swing.velocity = 0;
  world.swing.x = 1080 + 92 * Math.sin(0.38);
  world.swing.y = 116 + 92 * Math.cos(0.38);
}

// 4. The Escape Clutch — moth silhouetted at the moonlit window, two
// investigating cones converging and failing, dust near max but not full.
function stageEscape(world) {
  world.state = 'play';
  world.time = 0;
  world.displayTime = 0;
  setMoth(world, 1162, 78, -Math.PI / 2, 0.85, 1.3);
  addMotes(world, 1162, 78, 4, 12);
  // Ash and Cinder are hunting: wide cones, "!" up, converging on the
  // window — and missing.
  placeGuard(world, 0, 940, 310, -0.55, 'investigate', 1);
  placeGuard(world, 1, 200, 180, Math.PI / 2, 'patrol', 0);
  placeGuard(world, 2, 1090, 470, -1.35, 'investigate', 1);
  world.swing.angle = 0.3;
  world.swing.velocity = 0;
  world.swing.x = 1080 + 92 * Math.sin(0.3);
  world.swing.y = 116 + 92 * Math.cos(0.3);
}

const STAGERS = { setup: stageSetup, snuff: stageSnuff, swing: stageSwing, escape: stageEscape };

export function stageShot(world, name) {
  world.shot = name;
  STAGERS[name](world);
  refreshCones(world);
  return world;
}
