// Keyboard input for Moth & Lantern.
//
// The simulation reads this, never the DOM directly, so a scripted test can
// drive the same code path by feeding synthetic key sets. Movement keys are
// WASD plus the arrows; Space is the snuff-dash, E pushes the hanging
// lantern, P pauses, R restarts after a catch or an escape.

const MOVE_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export class Keys {
  constructor() {
    this.held = new Set();
    this.pressed = new Set(); // edge-triggered: cleared once per step
  }

  attach(target) {
    target.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
      if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    });
    target.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    target.addEventListener('blur', () => {
      this.held.clear();
    });
  }

  // Feed a synthetic key set (used by scripted tests and shot staging).
  feed(codes) {
    for (const code of codes) {
      if (!this.held.has(code)) this.pressed.add(code);
      this.held.add(code);
    }
  }

  release(codes) {
    for (const code of codes) this.held.delete(code);
  }

  isDown(code) {
    return this.held.has(code);
  }

  // True once per physical press; the simulation consumes it.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // The movement direction as a unit-ish vector (0,0 when idle).
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  // Clear the edge set after the simulation has read it.
  endStep() {
    this.pressed.clear();
  }
}
