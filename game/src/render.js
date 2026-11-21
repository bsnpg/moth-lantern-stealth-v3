// Moth & Lantern — the renderer.
//
// Plain Canvas 2D, no libraries. It reads the world state and paints one
// frame: floor, hard-shadow cover, clipped vision cones with their danger
// fringe, the moth (whose wings and dust trail are the only Wing Dust
// readout), and the HUD. Nothing here mutates the world.

import {
  ARENA,
  CONE,
  EXIT,
  FIELD,
  FONT,
  PALETTE,
  SNUFF,
  SWING,
  UI_FONT,
  WALL_LANTERN_LIGHT,
} from './config.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function poly(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

// ---- floor and cover ------------------------------------------------------------

function drawFloor(ctx, world) {
  // The wall band around the arena.
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  ctx.fillStyle = PALETTE.wallTop;
  ctx.fillRect(0, 0, FIELD.w, 10);

  // Pale stone tiles, 64 px, alternating shades, grout between them.
  const tile = 64;
  for (let ty = ARENA.y; ty < ARENA.y + ARENA.h; ty += tile) {
    for (let tx = ARENA.x; tx < ARENA.x + ARENA.w; tx += tile) {
      const col = Math.floor((tx - ARENA.x) / tile);
      const row = Math.floor((ty - ARENA.y) / tile);
      ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.floor : PALETTE.floorDark;
      ctx.fillRect(tx, ty, tile, tile);
    }
  }
  ctx.strokeStyle = PALETTE.grout;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, ARENA.y);
    ctx.lineTo(x, ARENA.y + ARENA.h);
    ctx.stroke();
  }
  for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += tile) {
    ctx.beginPath();
    ctx.moveTo(ARENA.x, y);
    ctx.lineTo(ARENA.x + ARENA.w, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The courtyard mosaic: two quiet rings around the centre.
  ctx.strokeStyle = PALETTE.grout;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.arc(640, 320, 92, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(640, 320, 62, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCover(ctx, world) {
  for (const rect of world.cover) {
    const isScreen = rect.w === 16;
    const isPillar = rect.w === 44 && rect.h === 44;
    if (isScreen) {
      ctx.fillStyle = PALETTE.screenFrame;
      ctx.fillRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
      ctx.fillStyle = PALETTE.screen;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = PALETTE.screenFrame;
      ctx.lineWidth = 1;
      for (let y = rect.y + 28; y < rect.y + rect.h - 8; y += 28) {
        ctx.beginPath();
        ctx.moveTo(rect.x, y);
        ctx.lineTo(rect.x + rect.w, y);
        ctx.stroke();
      }
    } else if (isPillar) {
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, 4);
    } else if (rect.w === 38) {
      // Stone lanterns: a squat block with a glowing slit.
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = PALETTE.stone;
      ctx.fillRect(rect.x + 3, rect.y + 3, rect.w - 6, rect.h - 6);
      ctx.fillStyle = PALETTE.lanternCore;
      ctx.fillRect(rect.x + rect.w / 2 - 3, rect.y + 8, 6, 10);
    } else {
      // Scroll stacks and the lone stone block.
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = PALETTE.screen;
      ctx.fillRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
      ctx.strokeStyle = PALETTE.screenFrame;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rect.x + 2, rect.y + rect.h / 2);
      ctx.lineTo(rect.x + rect.w - 2, rect.y + rect.h / 2);
      ctx.stroke();
    }
  }
}

// ---- light ------------------------------------------------------------------------

function glow(ctx, x, y, radius, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
}

function drawWallLanterns(ctx, world) {
  for (const lantern of world.lanterns) {
    const lit = world.time >= lantern.outUntil;
    if (lit) {
      glow(ctx, lantern.x, lantern.y, WALL_LANTERN_LIGHT, 'rgba(255,249,196,0.34)', 'rgba(255,249,196,0)');
      ctx.fillStyle = PALETTE.lanternCore;
      rr(ctx, lantern.x - 7, lantern.y - 9, 14, 18, 3);
      ctx.fill();
      ctx.fillStyle = PALETTE.lanternGlow;
      rr(ctx, lantern.x - 4, lantern.y - 6, 8, 12, 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#3a3428';
      rr(ctx, lantern.x - 7, lantern.y - 9, 14, 18, 3);
      ctx.fill();
    }
  }
}

function drawInkBubbles(ctx, world) {
  for (const bubble of world.bubbles) {
    const age = world.time - bubble.born;
    const grown = Math.min(1, age / SNUFF.bubbleGrowSeconds);
    const r = grown * SNUFF.bubbleRadius;
    const fading = world.time > bubble.until - 0.5 ? (bubble.until - world.time) / 0.5 : 1;
    const g = ctx.createRadialGradient(bubble.x, bubble.y, r * 0.2, bubble.x, bubble.y, r);
    g.addColorStop(0, `rgba(5,5,15,${0.92 * fading})`);
    g.addColorStop(0.8, `rgba(5,5,15,${0.85 * fading})`);
    g.addColorStop(1, 'rgba(5,5,15,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(221,160,221,${0.5 * fading})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, r * 0.96, 0, TAU);
    ctx.stroke();
  }
}

// ---- guards and cones --------------------------------------------------------------

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    if (!guard.conePoly || guard.conePoly.length < 3) continue;
    const investigating = guard.mode === 'investigate';
    // The dim fringe: the wedge the guard can see into.
    ctx.fillStyle = investigating ? 'rgba(255,140,0,0.30)' : 'rgba(255,183,71,0.20)';
    poly(ctx, guard.conePoly);
    ctx.fill();
    // The bright core: step into this and you are caught.
    if (guard.corePoly && guard.corePoly.length > 2) {
      ctx.fillStyle = investigating ? 'rgba(255,120,0,0.42)' : 'rgba(255,215,0,0.30)';
      poly(ctx, guard.corePoly);
      ctx.fill();
      // The danger fringe: a thin gold halo around the core's edge.
      ctx.strokeStyle = PALETTE.dangerFringe;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      poly(ctx, guard.corePoly);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawGuard(ctx, guard) {
  const x = guard.x;
  const y = guard.y;
  // Halo from the lantern the priest carries.
  glow(ctx, x, y, 46, 'rgba(255,140,0,0.28)', 'rgba(255,140,0,0)');
  // Robe: a sandy bell with a darker hem.
  ctx.fillStyle = PALETTE.robeDark;
  ctx.beginPath();
  ctx.moveTo(x - 13, y + 14);
  ctx.lineTo(x - 8, y - 8);
  ctx.lineTo(x + 8, y - 8);
  ctx.lineTo(x + 13, y + 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.robe;
  ctx.beginPath();
  ctx.moveTo(x - 10, y + 12);
  ctx.lineTo(x - 6, y - 8);
  ctx.lineTo(x + 6, y - 8);
  ctx.lineTo(x + 10, y + 12);
  ctx.closePath();
  ctx.fill();
  // Hooded head and the lantern's bright dot.
  ctx.fillStyle = PALETTE.robeDark;
  ctx.beginPath();
  ctx.arc(x, y - 12, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PALETTE.lanternCore;
  ctx.beginPath();
  ctx.arc(x + Math.cos(guard.facing) * 10, y + Math.sin(guard.facing) * 10, 3.5, 0, TAU);
  ctx.fill();
  // Suspicion and alarm marks.
  if (guard.mode === 'investigate') {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 26px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 30);
  } else if (guard.suspicion > 0.25) {
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 22px ' + UI_FONT;
    ctx.textAlign = 'center';
    ctx.fillText('?', x, y - 30);
  }
}

// ---- the swinging lantern -------------------------------------------------------------

function drawSwing(ctx, world) {
  const pivot = SWING.pivot;
  const head = world.swing;
  // The glowing arc of the swing's path: the timing window, made visible.
  ctx.strokeStyle = 'rgba(255,215,0,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, SWING.arm, Math.PI / 2 - SWING.amplitude, Math.PI / 2 + SWING.amplitude);
  ctx.stroke();
  // The chain.
  ctx.strokeStyle = '#4a3226';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();
  // Its light.
  glow(ctx, head.x, head.y, SWING.lightRadius, 'rgba(255,249,196,0.32)', 'rgba(255,249,196,0)');
  // The lantern head.
  ctx.fillStyle = PALETTE.lanternCore;
  rr(ctx, head.x - 6, head.y - 8, 12, 16, 3);
  ctx.fill();
  ctx.fillStyle = PALETTE.lanternGlow;
  rr(ctx, head.x - 3, head.y - 5, 6, 10, 2);
  ctx.fill();
}

// ---- the moth ---------------------------------------------------------------------------

function drawMoth(ctx, world) {
  const moth = world.moth;
  const scale = world.shotMothScale || 1;
  const r = 13 * scale;
  // Dust motes drifting behind it.
  for (const mote of world.motes) {
    const fade = 1 - mote.age / mote.life;
    ctx.fillStyle = `rgba(221,160,221,${(0.55 * fade).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, 2.2 * scale, 0, TAU);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(moth.x, moth.y);
  ctx.rotate(moth.facing + Math.PI / 2);
  // Wings: they flutter fast when the dust is high, and droop with it.
  // Near light they hesitate — the flutter stutters instead of flowing.
  const hesitate = moth.dust > 0.55 ? 0.55 + 0.45 * Math.sin(moth.flutter * 2.3) : 1;
  const flap = Math.sin(moth.flutter) * 0.5 * hesitate;
  const droop = moth.droop * 0.45;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.5 + flap * 0.35 + droop));
    ctx.fillStyle = PALETTE.moth;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.ellipse(side * r * 0.85, -r * 0.2, r * 0.75, r * 1.05, side * 0.35, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(221,160,221,0.5)';
    ctx.beginPath();
    ctx.ellipse(side * r * 0.85, -r * 0.2, r * 0.35, r * 0.55, side * 0.35, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // Body and head.
  ctx.fillStyle = PALETTE.mothBody;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.32, r * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -r * 0.72, r * 0.3, 0, TAU);
  ctx.fill();
  // Antennae: they twitch in the dark, still in the light.
  const twitch = Math.sin(moth.twitch) * (moth.dust > 0.5 ? 0.08 : 0.3);
  ctx.strokeStyle = PALETTE.mothBody;
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * r * 0.14, -r * 0.9);
    ctx.quadraticCurveTo(
      side * r * 0.5,
      -r * 1.35,
      side * r * (0.62 + twitch),
      -r * 1.5,
    );
    ctx.stroke();
  }
  ctx.restore();
}

// ---- exit and HUD --------------------------------------------------------------------------

function drawExit(ctx) {
  const x = EXIT.x;
  const y = EXIT.y;
  const w = EXIT.w;
  const h = EXIT.h;
  // Moonlight spilling from the arched window.
  glow(ctx, x + w / 2, y + h / 2, 120, 'rgba(220,239,255,0.4)', 'rgba(220,239,255,0)');
  ctx.fillStyle = '#1c2436';
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + 26);
  ctx.quadraticCurveTo(x + w / 2, y - 22, x + w, y + 26);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.moonCore;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h - 4);
  ctx.lineTo(x + 6, y + 28);
  ctx.quadraticCurveTo(x + w / 2, y - 14, x + w - 6, y + 28);
  ctx.lineTo(x + w - 6, y + h - 4);
  ctx.closePath();
  ctx.fill();
  // Mullions.
  ctx.strokeStyle = '#1c2436';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 4);
  ctx.lineTo(x + w / 2, y + h - 4);
  ctx.moveTo(x + 6, y + h / 2);
  ctx.lineTo(x + w - 6, y + h / 2);
  ctx.stroke();
  // A pale moon in the glass.
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath();
  ctx.arc(x + w - 26, y + 22, 11, 0, TAU);
  ctx.fill();
  // The label under the window.
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 13px ' + UI_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', x + w / 2, y + h + 16);
}

function drawHud(ctx, world) {
  // HUD text sits on the pale floor, so every line gets a dark under-stroke
  // first; without it the muted lines wash out.
  const ink = (text, x, y, align) => {
    ctx.textAlign = align;
    ctx.fillStyle = 'rgba(42,36,56,0.85)';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(text, x, y);
  };

  // Title, small while playing.
  ctx.font = '20px ' + FONT;
  ink('MOTH & LANTERN', 52, 30, 'left');
  // The subtitle is skipped on the title screen: the title card already
  // carries it, and the card would cover this line.
  if (world.state !== 'title') {
    ctx.fillStyle = 'rgba(42,36,56,0.85)';
    ctx.font = '13px ' + UI_FONT;
    ctx.textAlign = 'left';
    ctx.fillText('Reach the moonlit window — unseen', 53, 51);
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Reach the moonlit window — unseen', 52, 50);
  }

  // Timer, top right.
  ctx.font = '20px ' + UI_FONT;
  ink(formatTime(world.displayTime), FIELD.w - 52, 30, 'right');

  // Controls along the bottom.
  ctx.font = '13px ' + UI_FONT;
  ctx.fillStyle = 'rgba(42,36,56,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText(
    'WASD / arrows — move · SPACE — snuff-dash · E — push the hanging lantern · P — pause',
    FIELD.w / 2 + 1,
    FIELD.h - 11,
  );
  ctx.fillStyle = 'rgba(239,232,210,0.85)';
  ctx.fillText(
    'WASD / arrows — move · SPACE — snuff-dash · E — push the hanging lantern · P — pause',
    FIELD.w / 2,
    FIELD.h - 12,
  );

  // The snuff cooldown dot, bottom right.
  const ready = world.moth.snuffCooldown <= 0;
  ctx.fillStyle = ready ? PALETTE.lanternCore : '#6b6350';
  ctx.beginPath();
  ctx.arc(FIELD.w - 66, FIELD.h - 16, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(42,36,56,0.85)';
  ctx.font = '12px ' + UI_FONT;
  ctx.textAlign = 'right';
  ctx.fillText('SPACE — snuff', FIELD.w - 79, FIELD.h - 11);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('SPACE — snuff', FIELD.w - 80, FIELD.h - 12);
}

function drawTitleCard(ctx, world) {
  // Compact panel, top-left, so the courtyard's centre cones stay visible.
  const x = 52;
  const y = 52;
  const w = 400;
  const h = 104;
  ctx.fillStyle = 'rgba(10,10,26,0.88)';
  rr(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 6);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = '26px ' + FONT;
  ctx.fillText('MOTH & LANTERN', x + w / 2, y + 36);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '13px ' + UI_FONT;
  ctx.fillText('Hide in the hard shadows. Snuff a lantern to pass.', x + w / 2, y + 60);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '14px ' + UI_FONT;
  ctx.fillText('Press SPACE or click to begin', x + w / 2, y + 88);
}

function drawBanner(ctx, world) {
  ctx.fillStyle = 'rgba(10,10,26,0.72)';
  ctx.fillRect(0, FIELD.h / 2 - 56, FIELD.w, 112);
  ctx.textAlign = 'center';
  if (world.state === 'caught') {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 40px ' + FONT;
    ctx.fillText('SEEN', FIELD.w / 2, FIELD.h / 2 - 6);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px ' + UI_FONT;
    ctx.fillText('A lamp-priest caught you in the bright core. Press R to try again.', FIELD.w / 2, FIELD.h / 2 + 26);
  } else if (world.state === 'escaped') {
    ctx.fillStyle = PALETTE.moonCore;
    ctx.font = 'bold 40px ' + FONT;
    ctx.fillText('ESCAPED', FIELD.w / 2, FIELD.h / 2 - 6);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '16px ' + UI_FONT;
    ctx.fillText('Unseen, through the moonlit window. Press R to play again.', FIELD.w / 2, FIELD.h / 2 + 26);
  }
}

export function drawWorld(ctx, world) {
  ctx.clearRect(0, 0, FIELD.w, FIELD.h);
  drawFloor(ctx, world);
  drawWallLanterns(ctx, world);
  drawSwing(ctx, world);
  drawCones(ctx, world);
  drawCover(ctx, world);
  drawInkBubbles(ctx, world);
  // The exit window is painted before the actors: a moth at the window must
  // read silhouetted against the moonlight, not hidden behind the glass.
  drawExit(ctx);
  for (const guard of world.guards) drawGuard(ctx, guard);
  drawMoth(ctx, world);
  drawHud(ctx, world);
  if (world.state === 'title') drawTitleCard(ctx, world);
  if (world.state === 'caught' || world.state === 'escaped') drawBanner(ctx, world);
  if (world.shot) {
    // A paused ribbon so a frozen frame still reads as a staged shot.
    ctx.fillStyle = 'rgba(10,10,26,0.55)';
    ctx.fillRect(0, 0, FIELD.w, 8);
  }
}
