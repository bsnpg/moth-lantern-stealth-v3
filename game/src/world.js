// Moth & Lantern — the simulation.
//
// One fixed step (1/60 s) advances the whole world: the moth, three
// lamp-priest guards, the hanging lantern's pendulum, the ink bubbles and
// the Wing Dust reading. Nothing here touches the DOM; the renderer reads
// the state this file produces, and a scripted test can step it directly.
//
// The cone is the heart of the game. Each guard casts CONE.rays rays across
// its vision wedge; cover rectangles stop the rays, so the wedge is clipped
// into hard-shadow shapes. Drawing AND detection use those same rays: the
// moth is lit exactly when it lies inside the ray fan, and in the bright
// core when it lies inside the inner wedge. Hiding is geometry, not a roll.

import {
  ARENA,
  CONE,
  DUST,
  EXIT,
  GUARDS,
  MOTH,
  SNUFF,
  SWING,
  WALL_LANTERNS,
  WALL_LANTERN_LIGHT,
  allCoverRects,
} from './config.js';
import { makeRng } from './random.js';

const TAU = Math.PI * 2;

// The pendulum's gravity constant is tuned so its natural period is the
// design's 5.5 s: g/L = (2π / T)^2.
const PENDULUM_G = Math.pow(TAU / SWING.period, 2);
const PENDULUM_DAMPING = 0.12;

export function createWorld(seed = 1) {
  const rng = makeRng(seed);
  return {
    seed,
    rng,
    time: 0,
    state: 'title', // title | play | caught | escaped
    displayTime: 5, // the title card idles at 0:05
    shot: null, // null, or one of setup | snuff | swing | escape
    shotMothScale: 1,
    cover: allCoverRects(),
    moth: {
      x: MOTH.start.x,
      y: MOTH.start.y,
      facing: -Math.PI / 2,
      dashLeft: 0,
      dashDir: { x: 0, y: -1 },
      snuffCooldown: 0,
      dust: DUST.start,
      flutter: 0,
      droop: 0,
      twitch: 0,
      moving: false,
    },
    guards: GUARDS.map((g) => ({
      name: g.name,
      x: g.start.x,
      y: g.start.y,
      facing: 0,
      waypoints: g.waypoints,
      waypointIndex: 1,
      pause: g.pause,
      pauseLeft: 0,
      mode: 'patrol', // patrol | investigate
      suspicion: 0,
      investigateLeft: 0,
      lastSeen: null,
      sweepPhase: rng() * TAU,
      conePoly: [],
      litMoth: false,
      coreMoth: false,
    })),
    lanterns: WALL_LANTERNS.map((p) => ({ x: p.x, y: p.y, outUntil: 0 })),
    swing: {
      angle: 0.12,
      velocity: 0,
      x: SWING.pivot.x + SWING.arm * Math.sin(0.12),
      y: SWING.pivot.y + SWING.arm * Math.cos(0.12),
    },
    bubbles: [], // { x, y, born, until, radius }
    motes: [], // dust motes drifting behind the moth
    moteClock: 0,
    message: null, // 'caught' | 'escaped' banner text
  };
}

// ---- geometry helpers -------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Distance from point (px,py) to segment (x1,y1)-(x2,y2).
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Ray vs axis-aligned rectangle: distance along the ray to the first hit, or
// Infinity when the ray misses. The ray starts at (ox,oy) with unit direction.
function rayHitRect(ox, oy, dx, dy, rect) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    { o: ox, d: dx, lo: rect.x, hi: rect.x + rect.w },
    { o: oy, d: dy, lo: rect.y, hi: rect.y + rect.h },
  ];
  for (const a of axes) {
    if (Math.abs(a.d) < 1e-9) {
      if (a.o < a.lo || a.o > a.hi) return Infinity;
    } else {
      let t1 = (a.lo - a.o) / a.d;
      let t2 = (a.hi - a.o) / a.d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// Cast one ray from (ox,oy) along `angle`; it stops at the first cover rect,
// the arena wall, or the cone's range.
function castRay(world, ox, oy, angle, maxDist) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = maxDist;
  for (const rect of world.cover) {
    const hit = rayHitRect(ox, oy, dx, dy, rect);
    if (hit < best) best = hit;
  }
  // The arena's inner walls stop rays too.
  const walls = [
    { x: ARENA.x, y: ARENA.y - 40, w: ARENA.w, h: 40 },
    { x: ARENA.x, y: ARENA.y + ARENA.h, w: ARENA.w, h: 40 },
    { x: ARENA.x - 40, y: ARENA.y, w: 40, h: ARENA.h },
    { x: ARENA.x + ARENA.w, y: ARENA.y, w: 40, h: ARENA.h },
  ];
  for (const rect of walls) {
    const hit = rayHitRect(ox, oy, dx, dy, rect);
    if (hit < best) best = hit;
  }
  return best;
}

// The cone's ray fan for a guard: 26 lengths across its wedge.
function coneRays(world, guard, halfAngle) {
  const rays = [];
  for (let i = 0; i < CONE.rays; i++) {
    const a = guard.facing - halfAngle + (2 * halfAngle * i) / (CONE.rays - 1);
    rays.push({ angle: a, length: castRay(world, guard.x, guard.y, a, CONE.range) });
  }
  return rays;
}

// How far the cone reaches at a given angle offset from the guard's facing,
// interpolated between the two neighbouring rays.
function coneReachAt(rays, halfAngle, offset) {
  const clamped = clamp(offset, -halfAngle, halfAngle);
  const pos = ((clamped + halfAngle) / (2 * halfAngle)) * (CONE.rays - 1);
  const i = Math.min(Math.floor(pos), CONE.rays - 2);
  const f = pos - i;
  return rays[i].length + (rays[i + 1].length - rays[i].length) * f;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

// ---- collision ---------------------------------------------------------------

// Push a circle out of every cover rect and clamp it inside the arena.
function collide(world, body, radius) {
  for (const rect of world.cover) {
    const cx = clamp(body.x, rect.x, rect.x + rect.w);
    const cy = clamp(body.y, rect.y, rect.y + rect.h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * radius;
        body.y = cy + (dy / d) * radius;
      } else {
        // Dead centre: shove out along the smallest overlap.
        const pushLeft = body.x - (rect.x - radius);
        const pushRight = rect.x + rect.w + radius - body.x;
        const pushUp = body.y - (rect.y - radius);
        const pushDown = rect.y + rect.h + radius - body.y;
        const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (m === pushLeft) body.x = rect.x - radius;
        else if (m === pushRight) body.x = rect.x + rect.w + radius;
        else if (m === pushUp) body.y = rect.y - radius;
        else body.y = rect.y + rect.h + radius;
      }
    }
  }
  body.x = clamp(body.x, ARENA.x + radius, ARENA.x + ARENA.w - radius);
  body.y = clamp(body.y, ARENA.y + radius, ARENA.y + ARENA.h - radius);
}

// ---- moth ---------------------------------------------------------------------

function mothInBubble(world, x, y) {
  return world.bubbles.some((b) => {
    const age = world.time - b.born;
    const r = Math.min(SNUFF.bubbleRadius, (age / SNUFF.bubbleGrowSeconds) * SNUFF.bubbleRadius);
    return Math.hypot(x - b.x, y - b.y) < r;
  });
}

function lanternLitAt(world, lantern) {
  return world.time >= lantern.outUntil;
}

function nearestLitLantern(world, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const lantern of world.lanterns) {
    if (!lanternLitAt(world, lantern)) continue;
    const d = Math.hypot(lantern.x - x, lantern.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = lantern;
    }
  }
  return { lantern: best, dist: bestDist };
}

function updateMoth(world, keys, dt) {
  const moth = world.moth;
  const move = keys.moveVector();
  moth.moving = move.x !== 0 || move.y !== 0;
  if (moth.moving) moth.facing = Math.atan2(move.y, move.x);

  // Snuff-dash on Space, if the cooldown has cleared.
  if (keys.wasPressed('Space') && moth.snuffCooldown <= 0 && moth.dashLeft <= 0) {
    moth.dashLeft = MOTH.dashTime;
    moth.dashDir = moth.moving ? move : { x: Math.cos(moth.facing), y: Math.sin(moth.facing) };
    moth.snuffCooldown = SNUFF.cooldownSeconds;
    const { lantern, dist } = nearestLitLantern(world, moth.x, moth.y);
    if (lantern && dist <= SNUFF.range) {
      lantern.outUntil = world.time + SNUFF.outSeconds;
      world.bubbles.push({
        x: lantern.x,
        y: lantern.y,
        born: world.time,
        until: world.time + SNUFF.outSeconds + 0.5,
      });
    }
  }
  if (moth.snuffCooldown > 0) moth.snuffCooldown -= dt;

  // Move: dash speed along the dash direction, else walking speed.
  if (moth.dashLeft > 0) {
    moth.dashLeft -= dt;
    moth.x += moth.dashDir.x * MOTH.dashSpeed * dt;
    moth.y += moth.dashDir.y * MOTH.dashSpeed * dt;
  } else if (moth.moving) {
    moth.x += move.x * MOTH.speed * dt;
    moth.y += move.y * MOTH.speed * dt;
  }
  collide(world, moth, MOTH.radius);

  // Push the hanging lantern with E, when close enough to its head.
  if (keys.wasPressed('KeyE')) {
    const d = Math.hypot(world.swing.x - moth.x, world.swing.y - moth.y);
    if (d <= SWING.pushRange) {
      const dir = world.swing.velocity >= 0 ? 1 : -1;
      world.swing.velocity += dir * SWING.pushImpulse;
    }
  }
}

// ---- guards -------------------------------------------------------------------

function guardSeeMoth(world, guard) {
  const moth = world.moth;
  if (mothInBubble(world, moth.x, moth.y)) return { lit: false, core: false };
  const dx = moth.x - guard.x;
  const dy = moth.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > CONE.range || dist < 1) return { lit: false, core: false };
  const half = guard.mode === 'investigate' ? CONE.investigateHalfAngle : CONE.halfAngle;
  const offset = angleDiff(Math.atan2(dy, dx), guard.facing);
  if (Math.abs(offset) > half) return { lit: false, core: false };
  const reach = coneReachAt(guard.rays, half, offset);
  if (dist > reach) return { lit: false, core: false };
  const core = Math.abs(offset) <= CONE.coreHalfAngle && dist <= CONE.range * CONE.coreRange;
  return { lit: true, core };
}

function updateGuard(world, guard, dt) {
  const moth = world.moth;
  const half = guard.mode === 'investigate' ? CONE.investigateHalfAngle : CONE.halfAngle;
  guard.rays = coneRays(world, guard, half);
  const seen = guardSeeMoth(world, guard);
  guard.litMoth = seen.lit;
  guard.coreMoth = seen.core;

  if (seen.core) {
    world.state = 'caught';
    world.message = 'caught';
    return;
  }

  if (guard.mode === 'patrol') {
    if (seen.lit) {
      guard.suspicion += dt / CONE.suspicionSeconds;
      guard.lastSeen = { x: moth.x, y: moth.y };
      if (guard.suspicion >= 1) {
        guard.mode = 'investigate';
        guard.investigateLeft = CONE.investigateSeconds;
      }
    } else {
      guard.suspicion = Math.max(0, guard.suspicion - dt / 2);
    }

    if (guard.pauseLeft > 0) {
      guard.pauseLeft -= dt;
      // Look around while waiting: a slow sweep either side of the next leg.
      const target = guard.waypoints[guard.waypointIndex];
      const base = Math.atan2(target.y - guard.y, target.x - guard.x);
      guard.sweepPhase += dt * 2.6;
      guard.facing = base + Math.sin(guard.sweepPhase) * 0.45;
      return;
    }

    const target = guard.waypoints[guard.waypointIndex];
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 4) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.pauseLeft = guard.pause;
      return;
    }
    const step = Math.min(CONE.patrolSpeed * dt, dist);
    guard.x += (dx / dist) * step;
    guard.y += (dy / dist) * step;
    guard.facing = Math.atan2(dy, dx);
    collide(world, guard, 16);
  } else {
    // Investigating: hurry to the last place the moth was glimpsed.
    guard.investigateLeft -= dt;
    if (seen.lit) {
      guard.lastSeen = { x: moth.x, y: moth.y };
      guard.investigateLeft = CONE.investigateSeconds;
    }
    const target = guard.lastSeen || { x: guard.x, y: guard.y };
    const dx = target.x - guard.x;
    const dy = target.y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 12) {
      const step = Math.min(CONE.investigateSpeed * dt, dist);
      guard.x += (dx / dist) * step;
      guard.y += (dy / dist) * step;
      guard.facing = Math.atan2(dy, dx);
      collide(world, guard, 16);
    } else {
      // Arrived and found nothing: sweep the cone, hunting.
      guard.sweepPhase += dt * 3.4;
      guard.facing += Math.sin(guard.sweepPhase) * 0.02;
    }
    if (guard.investigateLeft <= 0) {
      guard.mode = 'patrol';
      guard.suspicion = 0;
      guard.lastSeen = null;
    }
  }
}

// ---- dust, swing, bubbles -------------------------------------------------------

function updateDust(world, dt) {
  const moth = world.moth;
  let inFringe = false;
  let inWallLight = false;
  let inSwingLight = false;
  for (const guard of world.guards) {
    if (guard.litMoth && !guard.coreMoth) inFringe = true;
  }
  for (const lantern of world.lanterns) {
    if (lanternLitAt(world, lantern) && Math.hypot(lantern.x - moth.x, lantern.y - moth.y) < WALL_LANTERN_LIGHT) {
      inWallLight = true;
    }
  }
  if (Math.hypot(world.swing.x - moth.x, world.swing.y - moth.y) < SWING.lightRadius) {
    inSwingLight = true;
  }
  const dashing = moth.dashLeft > 0;
  let rate = 0;
  if (inFringe) rate += DUST.inFringe;
  if (inWallLight) rate += DUST.inLight;
  if (inSwingLight) rate += DUST.inSwingLight;
  if (dashing) rate += DUST.whileDashing;
  if (rate === 0) rate = DUST.inDark;
  moth.dust = clamp(moth.dust + rate * dt, 0, 1);

  // Wings: calm and slow in shadow, fast and stuttering in the light.
  const flutterSpeed = 6 + moth.dust * 9;
  moth.flutter += flutterSpeed * dt * TAU;
  moth.droop = moth.dust * 0.5;
  moth.twitch += (inWallLight || inFringe ? 0.4 : 1.6) * dt * TAU;

  // Dust motes trail the moth, thicker the dustier it is.
  world.moteClock += dt * (4 + moth.dust * 26);
  while (world.moteClock >= 1 && world.motes.length < 90) {
    world.moteClock -= 1;
    world.motes.push({
      x: moth.x + (world.rng() - 0.5) * 18,
      y: moth.y + (world.rng() - 0.5) * 18,
      age: 0,
      life: 0.9 + world.rng() * 0.7,
      drift: world.rng() * TAU,
    });
  }
  for (const mote of world.motes) {
    mote.age += dt;
    mote.x += Math.cos(mote.drift) * 6 * dt;
    mote.y += Math.sin(mote.drift) * 6 * dt - 4 * dt;
  }
  world.motes = world.motes.filter((m) => m.age < m.life);
}

function updateSwing(world, dt) {
  const swing = world.swing;
  const accel = -PENDULUM_G * Math.sin(swing.angle) - PENDULUM_DAMPING * swing.velocity;
  swing.velocity += accel * dt;
  swing.angle += swing.velocity * dt;
  swing.angle = clamp(swing.angle, -1.1, 1.1);
  swing.velocity = clamp(swing.velocity, -3, 3);
  swing.x = SWING.pivot.x + SWING.arm * Math.sin(swing.angle);
  swing.y = SWING.pivot.y + SWING.arm * Math.cos(swing.angle);
}

function updateBubbles(world) {
  world.bubbles = world.bubbles.filter((b) => world.time < b.until);
}

// Rebuild every guard's cone polygons from the live ray fan, for the
// renderer. The fringe wedge uses the full half-angle; the bright core is a
// smaller wedge (core half-angle, 60% of the range), clipped by the same
// rays. Called every step and once after shot staging, so a frozen staged
// world still draws correct cones.
export function refreshCones(world) {
  for (const guard of world.guards) {
    const half = guard.mode === 'investigate' ? CONE.investigateHalfAngle : CONE.halfAngle;
    guard.rays = coneRays(world, guard, half);
    const fringe = [{ x: guard.x, y: guard.y }];
    for (const ray of guard.rays) {
      fringe.push({
        x: guard.x + Math.cos(ray.angle) * ray.length,
        y: guard.y + Math.sin(ray.angle) * ray.length,
      });
    }
    guard.conePoly = fringe;
    const core = [{ x: guard.x, y: guard.y }];
    const coreSteps = 12;
    for (let i = 0; i <= coreSteps; i++) {
      const a = guard.facing - CONE.coreHalfAngle + (2 * CONE.coreHalfAngle * i) / coreSteps;
      const reach = Math.min(
        CONE.range * CONE.coreRange,
        coneReachAt(guard.rays, half, angleDiff(a, guard.facing)),
      );
      core.push({ x: guard.x + Math.cos(a) * reach, y: guard.y + Math.sin(a) * reach });
    }
    guard.corePoly = core;
  }
}

// ---- the step -------------------------------------------------------------------

export function stepWorld(world, keys, dt) {
  if (world.state !== 'play') return;
  world.time += dt;
  world.displayTime = Math.floor(world.time);

  updateMoth(world, keys, dt);
  updateSwing(world, dt);
  for (const guard of world.guards) {
    updateGuard(world, guard, dt);
    if (world.state === 'caught') break;
  }
  if (world.state === 'caught') return;
  updateDust(world, dt);
  updateBubbles(world);
  refreshCones(world);

  // The moonlit window: reaching it unseen is the escape.
  const moth = world.moth;
  if (moth.x > EXIT.x && moth.x < EXIT.x + EXIT.w && moth.y > EXIT.y && moth.y < EXIT.y + EXIT.h) {
    world.state = 'escaped';
    world.message = 'escaped';
  }
}

export function startPlay(world) {
  world.state = 'play';
  world.displayTime = 0;
  world.time = 0;
}

export function resetWorld(world) {
  const fresh = createWorld(world.seed);
  fresh.shot = world.shot;
  Object.keys(fresh).forEach((k) => {
    world[k] = fresh[k];
  });
  world.state = 'title';
  world.displayTime = 5;
}

// A short deterministic fingerprint of the live state, for the 2-run check.
export function stateHash(world) {
  const parts = [
    world.state,
    world.time.toFixed(3),
    world.moth.x.toFixed(2),
    world.moth.y.toFixed(2),
    world.moth.dust.toFixed(3),
    world.swing.angle.toFixed(4),
    world.swing.velocity.toFixed(4),
  ];
  for (const g of world.guards) {
    parts.push(
      g.x.toFixed(2),
      g.y.toFixed(2),
      g.facing.toFixed(3),
      g.suspicion.toFixed(3),
      g.mode,
    );
  }
  for (const l of world.lanterns) parts.push(l.outUntil.toFixed(2));
  parts.push(String(world.bubbles.length));
  const text = parts.join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
