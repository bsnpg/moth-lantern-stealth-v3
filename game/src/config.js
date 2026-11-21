// Moth & Lantern — tuning table.
// One place holds every number the simulation and the renderer agree on, so a
// level tweak never needs a hunt through the logic. Values are the design's
// own: a slow, readable stealth pace (moth 252 px/s against guards at 55),
// cones that forgive a graze for 1.5 s, and a 4-second ink bubble that buys
// exactly one crossing.

export const FIELD = { w: 1280, h: 720 };

// The temple floor the moth may walk on. Everything outside it is wall.
export const ARENA = { x: 36, y: 36, w: 1208, h: 648 };

export const STEP = 1 / 60;

export const MOTH = {
  radius: 13,
  speed: 252,
  dashSpeed: 640,
  dashTime: 0.18,
  dashDistance: 118,
  start: { x: 122, y: 618 },
};

// Wing Dust is a 0..1 reading of how exposed the moth is. It is never drawn
// as a bar: it drives wing flutter, droop and the dust trail instead.
export const DUST = {
  start: 0.15,
  inFringe: 0.24, // per second, moth inside a cone's dim fringe
  inLight: 0.34, // per second, moth inside a wall lantern's light
  inSwingLight: 0.3, // per second, moth inside the hanging lantern's light
  whileDashing: 0.16, // per second, spent while dashing
  inDark: -0.32, // per second, moth in full shadow
};

export const SNUFF = {
  range: 175, // a lit wall lantern this close is snuffed by the dash
  outSeconds: 4, // how long the lantern stays dark
  cooldownSeconds: 6, // between snuffs
  bubbleRadius: 132, // the ink bubble's full size
  bubbleGrowSeconds: 0.6, // the bubble takes this long to bloom
};

export const CONE = {
  range: 272,
  halfAngle: (30 * Math.PI) / 180,
  coreHalfAngle: (20 * Math.PI) / 180,
  coreRange: 0.6, // the bright core reaches 60% of the full range
  rays: 26, // raycasts per cone; drawing and detection share them
  suspicionSeconds: 1.5, // fringe exposure needed before investigation
  investigateSeconds: 4, // the guard gives up after this long
  patrolSpeed: 55,
  investigateSpeed: 88,
  catchRadius: 26,
  investigateHalfAngle: (40 * Math.PI) / 180, // the cone widens while hunting
};

export const SWING = {
  pivot: { x: 1080, y: 116 },
  arm: 92,
  amplitude: 0.46, // radians of swing either side of straight down
  period: 5.5, // seconds per full swing
  lightRadius: 150,
  pushImpulse: 1.4, // angular kick from one E press
  pushRange: 70, // the moth must be this close to the lantern to push
};

export const EXIT = { x: 1130, y: 40, w: 106, h: 76 };

// Wall lanterns: fixed lights. Snuffing one drops a bubble of dark.
export const WALL_LANTERNS = [
  { x: 132, y: 172 },
  { x: 1150, y: 548 },
  { x: 640, y: 82 },
  { x: 92, y: 420 },
];
export const WALL_LANTERN_LIGHT = 195;

// Cover: every rectangle here blocks a guard's sight (the cone raycast stops
// at it) and blocks movement. x/y are the top-left corner.
export const COVER = {
  // Four pillars ringing the courtyard mosaic.
  pillars: [
    { x: 540, y: 216, w: 44, h: 44 },
    { x: 696, y: 216, w: 44, h: 44 },
    { x: 540, y: 380, w: 44, h: 44 },
    { x: 696, y: 380, w: 44, h: 44 },
  ],
  // Folding screens flanking the courtyard.
  screens: [
    { x: 498, y: 258, w: 16, h: 124 },
    { x: 766, y: 258, w: 16, h: 124 },
  ],
  // Stone lanterns on the left side.
  stoneLanterns: [
    { x: 176, y: 296, w: 38, h: 38 },
    { x: 296, y: 476, w: 38, h: 38 },
  ],
  // The narrow screen corridor on the right.
  corridor: [
    { x: 956, y: 176, w: 16, h: 112 },
    { x: 956, y: 328, w: 16, h: 112 },
    { x: 956, y: 480, w: 16, h: 112 },
  ],
  // Low scroll stacks.
  scrolls: [
    { x: 420, y: 560, w: 72, h: 26 },
    { x: 860, y: 560, w: 72, h: 26 },
    { x: 420, y: 138, w: 72, h: 26 },
  ],
  // A lone stone block near the bottom centre.
  stones: [{ x: 620, y: 556, w: 40, h: 40 }],
};

export function allCoverRects() {
  return [
    ...COVER.pillars,
    ...COVER.screens,
    ...COVER.stoneLanterns,
    ...COVER.corridor,
    ...COVER.scrolls,
    ...COVER.stones,
  ];
}

// Lamp-priests. Each patrols a loop of waypoints and pauses at each corner.
// The loops are dog-legged around the cover they would otherwise cross: Ash
// steps up and over the two folding screens on his top leg, Ember steps
// around the stone lantern on her vertical run. A straight leg through a
// screen would pin the guard against it forever.
export const GUARDS = [
  {
    name: 'Ash',
    start: { x: 470, y: 300 },
    waypoints: [
      { x: 470, y: 300 },
      { x: 470, y: 240 },
      { x: 810, y: 240 },
      { x: 810, y: 300 },
      { x: 810, y: 420 },
      { x: 470, y: 420 },
    ],
    pause: 0.9,
  },
  {
    name: 'Ember',
    start: { x: 200, y: 180 },
    waypoints: [
      { x: 200, y: 180 },
      { x: 200, y: 270 },
      { x: 250, y: 270 },
      { x: 250, y: 360 },
      { x: 200, y: 360 },
      { x: 200, y: 560 },
    ],
    pause: 1.1,
  },
  {
    name: 'Cinder',
    start: { x: 1050, y: 200 },
    waypoints: [
      { x: 1050, y: 200 },
      { x: 1050, y: 560 },
      { x: 1150, y: 560 },
      { x: 1150, y: 200 },
    ],
    pause: 0.8,
  },
];

export const PALETTE = {
  floor: '#b9a88c',
  floorDark: '#b2a387',
  grout: '#8f7f62',
  wall: '#2a2438',
  wallTop: '#3a324e',
  lanternCore: '#ffd700',
  lanternGlow: '#fff9c4',
  halo: '#ff8c00',
  dangerFringe: '#ffb347',
  shadow: '#0a0a1a',
  shadowSoft: '#1a1a2e',
  moth: '#e6e6fa',
  mothBody: '#4a4460',
  dust: '#dda0dd',
  robe: '#b08d5a',
  robeDark: '#7d6240',
  moon: '#dcefff',
  moonCore: '#f4faff',
  ink: '#05050f',
  text: '#efe8d2',
  muted: '#b9b09a',
  screen: '#e8dcc0',
  screenFrame: '#4a3226',
  stone: '#8a7f70',
  stoneDark: '#5f564a',
  gold: '#e8c15a',
};

export const FONT = 'Georgia, "Times New Roman", serif';
export const UI_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
