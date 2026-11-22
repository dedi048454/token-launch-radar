// Token Radar — the build program (Node 22, standard library only).
//
// Run it from this repository's root:
//
//   node main.ts --help
//   node main.ts --input /path/to/snapshot.json --output out
//
// What it does, in order:
//   1. Reads the sealed DefiLlama snapshot (default /input/snapshot.json, or
//      --input <snapshot.json|directory>).
//   2. Scores every pre-token protocol with the radar-2 model in lib/model.ts
//      and writes the ranked board to <output>/board.json.
//   3. Writes the dashboard's dataset to <output>/data.js.
//   4. Copies dashboard/ and screenshots/ into <output>.
//   5. Writes <output>/dossier.json with the vendored make.fun library, so the
//      gate can rebuild the same bytes and compare.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The dashboard is a static page with no network: dashboard/index.html reads
// data.js, which this program writes from the same board, so the page and the
// board can never disagree about a number.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const MIN_SCREENSHOTS = 3;

const HELP = `token radar — build the entry's output directory

usage:
  node main.ts [--input <snapshot.json|dir>] [--output <dir>]
  node main.ts --help

flags:
  --input <path>    sealed snapshot (default /input, or $MAKEFUN_INPUT_DIR)
  --output <dir>    where to write board.json, data.js, dashboard/,
                    screenshots/ and dossier.json (default $MAKEFUN_OUTPUT_DIR,
                    else /output)
  --help            print this text and exit

The dashboard is a static page: dashboard/index.html reads data.js, written
beside it from the same board, so the page and board.json always agree.
`;

/** The value of --name <value> (or --name=<value>), else the fallback. */
function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq === undefined ? fallback : eq.slice(name.length + 3);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(HELP);
  process.exit(0);
}

const inputArg = flag('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping dot-names; returns the names copied. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
if (dashboardFiles.length === 0) {
  process.stderr.write('token radar: dashboard/ is empty: the page needs index.html, a .css and a .js file\n');
  process.exit(1);
}
const shots = copyDir(join(here, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < MIN_SCREENSHOTS) {
  process.stderr.write(
    `token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in ${MIN_SCREENSHOTS}, the board, a detail view and a filtered view\n`,
  );
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this output and compares bytes.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols in the snapshot, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows ranked (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: top row is ${board[0]!.name} at $${board[0]!.implied_value_usd.toLocaleString('en-US')} implied value\n` +
    `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (${dashboardFiles.length} files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
);
