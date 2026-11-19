// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Checks I added so a half-built entry fails loudly here instead of
// silently handing the judge a broken game folder.
const entryHtml = join(here, 'game', 'index.html');
if (!existsSync(entryHtml)) {
  throw new Error('game/index.html is missing — the game has no entry point, aborting the build');
}
const shotsDir = join(here, 'screenshots');
const shotNames = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((name) => /\.(png|jpe?g)$/i.test(name)).sort()
  : [];
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3 or 4 screenshots in screenshots/, found ${shotNames.length}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build summary I print so the log shows exactly what was handed in.
function tallyDir(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      const sub = tallyDir(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

const gameTally = tallyDir(join(out, 'game'));
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(
  `build summary: ${gameTally.files} game files (${gameTally.bytes} bytes), ` +
    `${shotNames.length} screenshots, dossier.json ${dossierBytes} bytes`,
);
