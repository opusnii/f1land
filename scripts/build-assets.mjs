#!/usr/bin/env node
/**
 * Asset pipeline (docs/design/03-asset-prompts.md §2.2).
 *
 *   node scripts/build-assets.mjs [--src assets-src] [--force] [--only plates,objects]
 *
 * Input:  assets-src/<group>/<name>.png   (generated masters, not committed — see assets-src/README.md)
 * Output: public/assets/<group>/<name>-<w>.{avif,webp}
 *         public/assets/flags/<cc>-<w>.webp (rasterised from flag-icons, MIT)
 *         src/assets/manifest.ts          (size, dominant colour, widths per asset)
 *
 * Re-encodes only when the master is newer than its outputs unless --force.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
};
const SRC = path.resolve(root, arg('src', 'assets-src'));
const OUT = path.join(root, 'public/assets');
const MANIFEST = path.join(root, 'src/assets/manifest.ts');
const FORCE = arg('force', false) === true;
const ONLY = typeof arg('only') === 'string' ? new Set(arg('only').split(',')) : null;

/** Per-group encode profile. `trim` crops transparent margins; `square` pads the trimmed object to 1:1. */
const PROFILES = {
  plates: { widths: [390, 780, 1170], avif: 50, webp: 72 },
  art: { widths: [390, 780, 1024], avif: 50, webp: 72 },
  'art-obj': { widths: [160, 320, 480], avif: 55, webp: 80, trim: true },
  cars: { widths: [390, 780], avif: 55, webp: 80, trim: true },
  helmets: { widths: [96, 192, 288], avif: 55, webp: 80, trim: true, square: true },
  objects: { widths: [96, 192, 288], avif: 55, webp: 80, trim: true, square: true },
  badges: { widths: [96, 192, 288], avif: 55, webp: 80, trim: true, square: true },
  textures: { widths: [512], webp: 74, webpOnly: true },
  brand: { widths: [192, 512], avif: 60, webp: 82 },
};

const FLAG_WIDTHS = [40, 80];

const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function profileFor(group, meta) {
  if (group === 'art' && meta.hasAlpha) return PROFILES['art-obj'];
  return PROFILES[group];
}

function newer(src, outs) {
  if (FORCE) return true;
  const t = fs.statSync(src).mtimeMs;
  return outs.some((o) => !fs.existsSync(o) || fs.statSync(o).mtimeMs < t);
}

async function prepare(file, prof) {
  let img = sharp(file, { limitInputPixels: false });
  if (prof.trim) {
    // Alpha-only trim: generated objects sit on transparent canvases with uneven margins.
    const { data, info } = await sharp(file).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
    let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
    for (let y = 0; y < info.height; y++) {
      const row = y * info.width;
      for (let x = 0; x < info.width; x++) {
        if (data[row + x] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 >= x0 && y1 >= y0) {
      const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
      const left = Math.max(0, x0 - pad);
      const top = Math.max(0, y0 - pad);
      const width = Math.min(info.width - left, x1 - x0 + 1 + pad * 2);
      const height = Math.min(info.height - top, y1 - y0 + 1 + pad * 2);
      img = sharp(await sharp(file).extract({ left, top, width, height }).png().toBuffer());
    }
  }
  if (prof.square) {
    const m = await img.metadata();
    const side = Math.max(m.width, m.height);
    img = sharp(
      await img
        .extend({
          top: Math.floor((side - m.height) / 2),
          bottom: Math.ceil((side - m.height) / 2),
          left: Math.floor((side - m.width) / 2),
          right: Math.ceil((side - m.width) / 2),
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
    );
  }
  const buf = await img.png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width, h: meta.height, alpha: !!meta.hasAlpha };
}

async function dominant(buf, alpha) {
  // Mean of opaque pixels; for plates this is the placeholder shown while the image streams in.
  const { data, info } = await sharp(buf).resize(48, 48, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < info.width * info.height * 4; i += 4) {
    const a = data[i + 3] / 255;
    if (alpha && a < 0.5) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return n ? toHex({ r: r / n, g: g / n, b: b / n }) : '#10161a';
}

async function encode(buf, out, w, prof, srcW) {
  const width = Math.min(w, srcW);
  const base = sharp(buf).resize({ width, withoutEnlargement: true });
  const jobs = [];
  if (!prof.webpOnly) jobs.push(base.clone().avif({ quality: prof.avif, effort: 5 }).toFile(`${out}-${w}.avif`));
  jobs.push(base.clone().webp({ quality: prof.webp, effort: 5, alphaQuality: 90 }).toFile(`${out}-${w}.webp`));
  await Promise.all(jobs);
}

function readOldManifest() {
  if (!fs.existsSync(MANIFEST)) return {};
  const m = fs.readFileSync(MANIFEST, 'utf8').match(/\/\* data \*\/ (\{[\s\S]*\}) \/\* end \*\//);
  return m ? JSON.parse(m[1]) : {};
}

async function buildImages() {
  const entries = readOldManifest();
  const groups = fs.readdirSync(SRC).filter((g) => PROFILES[g] && fs.statSync(path.join(SRC, g)).isDirectory());
  const seen = new Map();
  const queue = [];
  for (const group of groups) {
    for (const f of fs.readdirSync(path.join(SRC, group)).sort()) {
      if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
      const name = f.replace(/\.[^.]+$/, '');
      if (seen.has(name)) throw new Error(`Duplicate asset name "${name}" in ${group} and ${seen.get(name)}`);
      seen.set(name, group);
      if (ONLY && !ONLY.has(group)) continue;
      queue.push({ group, name, file: path.join(SRC, group, f) });
    }
  }
  // Drop manifest entries whose master was removed.
  for (const k of Object.keys(entries)) if (!seen.has(k)) delete entries[k];

  let done = 0;
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const meta = await sharp(job.file).metadata();
      const prof = profileFor(job.group, meta);
      const dir = path.join(OUT, job.group);
      fs.mkdirSync(dir, { recursive: true });
      const out = path.join(dir, job.name);
      const outs = prof.widths.flatMap((w) => (prof.webpOnly ? [`${out}-${w}.webp`] : [`${out}-${w}.avif`, `${out}-${w}.webp`]));
      if (!newer(job.file, outs) && entries[job.name]) continue;
      const p = await prepare(job.file, prof);
      const widths = [...new Set(prof.widths.map((w) => Math.min(w, p.w)))];
      for (const w of prof.widths) await encode(p.buf, out, w, prof, p.w);
      entries[job.name] = { g: job.group, w: p.w, h: p.h, c: await dominant(p.buf, p.alpha), s: prof.widths, ...(p.alpha ? { a: 1 } : {}), ...(prof.webpOnly ? { f: 'webp' } : {}) };
      void widths;
      done++;
      process.stdout.write(`\r  encoded ${done} (${job.group}/${job.name})            `);
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  process.stdout.write('\n');
  return entries;
}

async function buildFlags() {
  // Country codes referenced by data; rasterised so a 20 px flag costs ~1 KB instead of a 50 KB SVG.
  const codes = new Set();
  for (const f of ['src/data/teams.ts', 'src/data/calendar.ts', 'src/demo/leaderboard.ts', 'src/data/circuits/generated/meta.json']) {
    const txt = fs.readFileSync(path.join(root, f), 'utf8');
    for (const m of txt.matchAll(/(?:countryCode"?\s*:\s*["']|['"])([A-Z]{2})['"]/g)) codes.add(m[1].toLowerCase());
  }
  const dir = path.join(OUT, 'flags');
  fs.mkdirSync(dir, { recursive: true });
  const srcDir = path.join(root, 'node_modules/flag-icons/flags/4x3');
  const out = [];
  for (const cc of [...codes].sort()) {
    const svg = path.join(srcDir, `${cc}.svg`);
    if (!fs.existsSync(svg)) continue;
    for (const w of FLAG_WIDTHS) {
      const dst = path.join(dir, `${cc}-${w}.webp`);
      if (FORCE || !fs.existsSync(dst)) await sharp(svg, { density: 300 }).resize(w, Math.round((w * 3) / 4), { fit: 'fill' }).webp({ quality: 86 }).toFile(dst);
    }
    out.push(cc);
  }
  return out;
}

function writeManifest(entries, flags) {
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
  const src = `// Generated by scripts/build-assets.mjs — do not edit by hand.
export interface AssetInfo {
  /** Group folder under public/assets. */
  g: string;
  /** Intrinsic size of the processed master (after trimming). */
  w: number;
  h: number;
  /** Mean colour, used as the loading placeholder. */
  c: string;
  /** Encoded widths. */
  s: number[];
  /** Has transparency. */
  a?: 1;
  /** Single-format asset (textures). */
  f?: 'webp';
}

const DATA = /* data */ ${JSON.stringify(sorted)} /* end */ satisfies Record<string, AssetInfo>;

export type AssetName = keyof typeof DATA;
export const ASSETS: Record<AssetName, AssetInfo> = DATA;
export const FLAG_CODES: ReadonlySet<string> = new Set(${JSON.stringify(flags)});
export const FLAG_WIDTHS = ${JSON.stringify(FLAG_WIDTHS)} as const;
`;
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, src);
}

if (!fs.existsSync(SRC)) {
  console.error(`No masters at ${SRC}. See assets-src/README.md for where to get them.`);
  process.exit(1);
}
const t0 = Date.now();
const entries = await buildImages();
const flags = await buildFlags();
writeManifest(entries, flags);
const size = (d) => fs.readdirSync(d, { recursive: true }).reduce((s, f) => { const p = path.join(d, f); return fs.statSync(p).isFile() ? s + fs.statSync(p).size : s; }, 0);
console.log(`assets: ${Object.keys(entries).length} images, ${flags.length} flags, public/assets = ${(size(OUT) / 1048576).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
