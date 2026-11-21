// Moth & Lantern — the hand-in program (Node 22, standard library only).
//
// The grader runs this file twice and both runs must write identical bytes.
// What it does, in order:
//   1. works out where the repository lives (beside this file) and where the
//      output goes (/output, or MAKEFUN_OUTPUT_DIR outside the grader);
//   2. copies the whole game/ folder and the screenshots/ folder across;
//   3. asks the vendored make.fun library to write /output/dossier.json,
//      the summary the judge reads, from those copied files.
//
// The dossier is capped at 163,840 bytes of source text: the library cuts
// the first source that does not fit and says what was left out. The game
// itself is small enough to fit whole.
//
// Run it locally the same way the grader does:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

function fail(message) {
  throw new Error(`Moth & Lantern hand-in: ${message}`);
}

function countEntries(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += 1;
    if (entry.isDirectory()) total += countEntries(join(dir, entry.name));
  }
  return total;
}

function handIn() {
  if (!existsSync(gameDir)) fail('game/ is missing from the repository');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  if (!existsSync(shotsDir)) fail('screenshots/ is missing from the repository');

  const shots = readdirSync(shotsDir).filter((name) => !name.startsWith('.'));
  if (shots.length < 3 || shots.length > 4) {
    fail(`expected 3 or 4 screenshots, found ${shots.length}`);
  }
  for (const name of shots) {
    const bytes = statSync(join(shotsDir, name)).size;
    if (bytes > 262144) fail(`screenshot ${name} is ${bytes} bytes, over the 256 KiB cap`);
  }
  if (countEntries(gameDir) > 993) fail('game/ holds more than 993 files and directories');

  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  // The scorer's own caps, as the kit documents them: only text_max_bytes
  // shapes the dossier's bytes; the rest refuse an entry the scorer would
  // refuse, so a bad hand-in fails here instead of on the server.
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  return { shots: shots.length, dossierBytes: Buffer.byteLength(dossier, 'utf8') };
}

const result = handIn();
console.log(`Moth & Lantern handed in: ${result.shots} screenshots, dossier ${result.dossierBytes} bytes.`);
