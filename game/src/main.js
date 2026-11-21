// Moth & Lantern — bootstrap and game loop.
//
// Wires the canvas, the keyboard and the simulation together. Two modes:
//   - a staged shot (?shot=setup|snuff|swing|escape&seed=N): one frozen
//     frame, rendered once, then window.__shotReady is set for the capture;
//   - live play: a fixed 1/60 s step driven by requestAnimationFrame, with
//     the title screen, pause, catch and escape states on top.
// The window.__game handle exposes the world and a manual stepper so a
// scripted test can drive the exact same code the player uses.

import { FIELD, STEP } from './config.js';
import { Keys } from './input.js';
import { createWorld, resetWorld, startPlay, stateHash, stepWorld } from './world.js';
import { drawWorld } from './render.js';
import { readShotFromUrl, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = FIELD.w;
canvas.height = FIELD.h;

const { shot, seed } = readShotFromUrl(window.location.search);
const world = createWorld(seed);
const keys = new Keys();
keys.attach(window);

let paused = false;
let lastTime = 0;
let accumulator = 0;

if (shot) {
  // A staged shot: freeze the frame, render once, signal readiness.
  stageShot(world, shot);
  drawWorld(ctx, world);
  window.__shotReady = true;
} else {
  // Live play.
  canvas.addEventListener('click', () => {
    if (world.state === 'title') startPlay(world);
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && world.state === 'title') startPlay(world);
    if (event.code === 'KeyR' && (world.state === 'caught' || world.state === 'escaped')) {
      resetWorld(world);
    }
    if (event.code === 'KeyP' && world.state === 'play') paused = !paused;
  });

  const frame = (now) => {
    const elapsed = Math.min(0.1, (now - lastTime) / 1000 || 0);
    lastTime = now;
    if (!paused) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepWorld(world, keys, STEP);
        keys.endStep();
        accumulator -= STEP;
      }
    }
    drawWorld(ctx, world);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// Scripted-test handle: the same world, stepper and fingerprint the live
// loop uses, reachable from the page for headless verification. setPaused
// freezes the live loop deterministically (a toggle would drift out of sync
// across resets).
window.__game = {
  world,
  keys,
  hash: () => stateHash(world),
  start: () => startPlay(world),
  reset: () => resetWorld(world),
  isPaused: () => paused,
  setPaused: (value) => {
    paused = !!value;
  },
  step: (count) => {
    for (let i = 0; i < count; i++) {
      stepWorld(world, keys, STEP);
      keys.endStep();
    }
  },
  hold: (codes) => keys.feed(codes),
  release: (codes) => keys.release(codes),
};
