// Seeded randomness for Moth & Lantern.
//
// The game is deterministic: the same seed always plays the same run, which is
// what lets two scripted runs hash identically. Everything random in the game
// (dust mote drift, the guard's look-around wobble) draws from one generator
// built here, so a replay only needs the seed, never a saved stream.

export function makeRng(seed) {
  // mulberry32: small, fast, and good enough for cosmetic drift.
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A number in [min, max) from a generator.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one element of an array.
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
