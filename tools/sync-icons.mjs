#!/usr/bin/env node
/**
 * sync-icons.mjs — one source of truth for the icon set.
 *
 * WHY THIS EXISTS
 * The 30 icons used to live in five places at once: the individual files in
 * `02-icons/`, `02-icons/sprite.svg`, a copy of that sprite inlined in
 * `03-preview/index.html`, the gallery markup in the same file, and
 * `../TacoTuesdayUI/public/icons.svg`. Plus the count in `README.md`.
 * Adding `sun` and `moon` (TD-004) meant editing four of them by hand, and
 * nothing — no build, no test, no CI — notices when one is forgotten. The
 * preview gallery would simply lie, in silence.
 *
 * SOURCE OF TRUTH
 *   `02-icons/<name>.svg`  — the drawing. One file per icon. Edit these.
 *   `02-icons/icons.json`  — which icons exist and in what order they show up.
 *
 * EVERYTHING ELSE IS GENERATED. Do not edit the generated blocks by hand;
 * the next run overwrites them.
 *
 * USAGE
 *   node tools/sync-icons.mjs            # regenerate every copy
 *   node tools/sync-icons.mjs --check    # change nothing, exit 1 if a copy drifted
 *
 * ADDING AN ICON
 *   1. Drop `02-icons/my-icon.svg` next to the others.
 *   2. Add "my-icon" to `02-icons/icons.json` where you want it to appear.
 *   3. Run this script.
 *   A file that is not in the list, or a name in the list with no file, is a
 *   hard error — which is the whole point: you cannot half-add an icon.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ICONS_DIR = join(ROOT, '02-icons');
const ORDER_FILE = join(ICONS_DIR, 'icons.json');
const SPRITE_FILE = join(ICONS_DIR, 'sprite.svg');
const PREVIEW_FILE = join(ROOT, '03-preview', 'index.html');
const README_FILE = join(ROOT, 'README.md');
const UI_SPRITE_FILE = resolve(ROOT, '..', 'TacoTuesdayUI', 'public', 'icons.svg');

const CHECK = process.argv.includes('--check');

/* Attributes a <symbol> keeps, in this order. `width`, `height`, `xmlns`,
 * `role` and `aria-label` belong to a standalone file, not to a symbol: the
 * consumer sets the size and the accessible name at the point of use. */
const SYMBOL_ATTRS = [
  'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
];

const SPRITE_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">';
const GEN = 'generado por tools/sync-icons.mjs — no editar a mano';
const MARK = {
  sprite: [`<!-- icons:sprite:start — ${GEN} -->`, '<!-- icons:sprite:end -->'],
  gallery: [`  <!-- icons:gallery:start — ${GEN} -->`, '  <!-- icons:gallery:end -->'],
};

const die = (msg) => { console.error(`sync-icons: ${msg}`); process.exit(2); };
const rel = (p) => relative(ROOT, p).replaceAll('\\', '/');

/* ---------- read the source of truth ---------- */

if (!existsSync(ORDER_FILE)) die(`missing ${rel(ORDER_FILE)}`);
let order;
try {
  order = JSON.parse(readFileSync(ORDER_FILE, 'utf8')).order;
} catch (e) {
  die(`${rel(ORDER_FILE)} is not valid JSON: ${e.message}`);
}
if (!Array.isArray(order) || order.length === 0) die(`${rel(ORDER_FILE)} needs a non-empty "order" array`);

const dupes = order.filter((n, i) => order.indexOf(n) !== i);
if (dupes.length) die(`duplicated in icons.json: ${[...new Set(dupes)].join(', ')}`);

const onDisk = readdirSync(ICONS_DIR)
  .filter((f) => f.endsWith('.svg') && f !== 'sprite.svg')
  .map((f) => f.slice(0, -4))
  .sort();

const missingFile = order.filter((n) => !onDisk.includes(n));
const unlisted = onDisk.filter((n) => !order.includes(n));
if (missingFile.length) die(`listed in icons.json but no file in 02-icons/: ${missingFile.join(', ')}`);
if (unlisted.length) die(`file in 02-icons/ but not listed in icons.json: ${unlisted.join(', ')} — add it to the list where you want it to appear`);

/* ---------- build every generated artefact ---------- */

function symbolFor(name) {
  const src = readFileSync(join(ICONS_DIR, `${name}.svg`), 'utf8');
  const open = src.match(/<svg\b([^>]*)>/);
  if (!open) die(`${name}.svg has no <svg> tag`);

  const attrs = new Map();
  for (const m of open[1].matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) attrs.set(m[1], m[2]);
  if (!attrs.has('viewBox')) die(`${name}.svg has no viewBox — a symbol without one does not scale`);

  const kept = SYMBOL_ATTRS
    .filter((a) => attrs.has(a))
    .map((a) => `${a}="${attrs.get(a)}"`)
    .join(' ');

  const close = src.lastIndexOf('</svg>');
  if (close === -1) die(`${name}.svg has no closing </svg>`);
  const inner = src.slice(open.index + open[0].length, close)
    .replace(/>\s+</g, '><')     // collapse only the whitespace between tags
    .trim();
  if (!inner) die(`${name}.svg draws nothing`);

  return `  <symbol id="tt-${name}" ${kept}>${inner}</symbol>`;
}

const symbols = order.map(symbolFor);
const sprite = [SPRITE_OPEN, ...symbols, '</svg>', ''].join('\n');

const gallery =
  '  <div class="icons">' +
  order.map((n) =>
    `<div class="ic"><svg width="24" height="24"><use href="#tt-${n}"/></svg><code>${n}</code></div>`
  ).join('') +
  '</div>';

/* ---------- compare / write ---------- */

const results = [];

function settle(file, next, { optional = false } = {}) {
  if (!existsSync(file)) {
    if (optional) { results.push({ file, state: 'skipped' }); return; }
    results.push({ file, state: 'missing' });
    return;
  }
  const current = readFileSync(file, 'utf8');
  if (current === next) { results.push({ file, state: 'ok' }); return; }
  if (CHECK) { results.push({ file, state: 'drifted' }); return; }
  writeFileSync(file, next, 'utf8');
  results.push({ file, state: 'written' });
}

/* sprite.svg, and its byte-for-byte twin in the UI */
settle(SPRITE_FILE, sprite);
settle(UI_SPRITE_FILE, sprite, { optional: true });

/* the two generated blocks inside the preview */
function replaceBlock(text, [start, end], body, label) {
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i === -1 || j === -1 || j < i) {
    die(`${rel(PREVIEW_FILE)} has no ${label} markers — expected\n  ${start}\n  ...\n  ${end}`);
  }
  return text.slice(0, i) + start + '\n' + body + '\n' + text.slice(j);
}

if (!existsSync(PREVIEW_FILE)) {
  results.push({ file: PREVIEW_FILE, state: 'missing' });
} else {
  let html = readFileSync(PREVIEW_FILE, 'utf8');
  html = replaceBlock(html, MARK.sprite, sprite.trimEnd(), 'sprite');
  html = replaceBlock(html, MARK.gallery, gallery, 'gallery');
  settle(PREVIEW_FILE, html);
}

/* the count in the README */
if (!existsSync(README_FILE)) {
  results.push({ file: README_FILE, state: 'missing' });
} else {
  const readme = readFileSync(README_FILE, 'utf8');
  if (!/\d+ iconos SVG/.test(readme)) die(`${rel(README_FILE)} no longer says "<n> iconos SVG" — the count cannot be kept honest`);
  settle(README_FILE, readme.replace(/\d+ iconos SVG/g, `${order.length} iconos SVG`));
}

/* ---------- report ---------- */

const bad = results.filter((r) => r.state === 'drifted' || r.state === 'missing');
for (const { file, state } of results) {
  const mark = { ok: 'ok     ', written: 'written', drifted: 'DRIFTED', missing: 'MISSING', skipped: 'skipped' }[state];
  console.log(`  ${mark}  ${rel(file)}`);
}
console.log(`  ${order.length} icons from ${rel(ICONS_DIR)}`);

if (bad.length) {
  console.error(
    CHECK
      ? `\nsync-icons: ${bad.length} copy/copies out of date. Run \`node tools/sync-icons.mjs\` and commit the result.`
      : `\nsync-icons: could not reach ${bad.length} file(s).`
  );
  process.exit(1);
}
console.log(CHECK ? '\nsync-icons: every copy matches the source.' : '\nsync-icons: done.');
