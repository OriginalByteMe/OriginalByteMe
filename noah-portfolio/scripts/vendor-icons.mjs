#!/usr/bin/env node
// Vendors the light-theme icon of every skill, operating system and project technology in
// content/about-me into public/icons/, and writes public/icons/manifest.json (remote URL to
// local path) for lib/character/world-content.ts, so the 3D town only loads same-origin images.
//
//   node scripts/vendor-icons.mjs
//
// Re-runnable: each distinct URL is fetched once; files already vendored for a URL are kept
// (and re-checked) without network, and files no longer referenced are removed. Downloads come
// from third-party CDNs, so each one must have the content type its extension promises, stay
// under MAX_BYTES and pass a content check (PNG signature, or an SVG with no scripts, event
// handlers or external references). SVGs get a pixel width and height from their viewBox:
// without an intrinsic size the browser rasterises them at 300x150 for WebGL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(APP, 'content/about-me');
const OUT = path.join(APP, 'public/icons');
const MANIFEST = path.join(OUT, 'manifest.json');
const MAX_BYTES = 512 * 1024;
const SVG_SIZE = 256;
const TYPES = { svg: 'image/svg+xml', png: 'image/png' };
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const front = (file) => matter(fs.readFileSync(path.join(CONTENT, file), 'utf8')).data;
const wanted = [
  ...front('skills.md').skills.flatMap((group) => group.skills.map((skill) => ({ name: skill.name, url: skill.lightImage }))),
  ...front('operating-systems.md').operatingSystems.flatMap((group) => group.systems.map((system) => ({ name: system.name, url: system.lightImage }))),
  ...fs.readdirSync(path.join(CONTENT, 'projects')).filter((file) => file.endsWith('.md')).sort()
    .flatMap((file) => (front(`projects/${file}`).technologies ?? []).map((tech) => ({ name: tech.name, url: tech.lightIcon }))),
];

function extension(url) {
  const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase();
  if (!(ext in TYPES)) throw new Error(`${url}: only ${Object.keys(TYPES).join(' and ')} icons are vendored`);
  return ext;
}

/** Checks the bytes and returns what to commit: SVGs sized from their viewBox. */
function checked(url, ext, bytes) {
  if (bytes.length === 0 || bytes.length > MAX_BYTES) throw new Error(`${url}: ${bytes.length} bytes, expected 1 to ${MAX_BYTES}`);
  if (ext === 'png') {
    if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${url}: not a PNG`);
    return bytes;
  }
  const text = bytes.toString('utf8');
  const root = /<svg\b[^>]*>/i.exec(text);
  if (!root) throw new Error(`${url}: no <svg> element`);
  const unsafe = /<script\b|<foreignObject\b|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=\s*["'](?!#|data:image\/)/i.exec(text);
  if (unsafe) throw new Error(`${url}: unsafe SVG content near "${unsafe[0]}"`);
  const box = /\sviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(root[0]);
  if (!box) throw new Error(`${url}: no viewBox to size the SVG from`);
  const [width, height] = [Number(box[1]), Number(box[2])];
  const scale = SVG_SIZE / Math.max(width, height);
  const sized = root[0].replace(/\s(?:width|height)\s*=\s*["'][^"']*["']/gi, '').replace(/^<svg/i, `<svg width="${Math.round(width * scale)}" height="${Math.round(height * scale)}"`);
  return Buffer.from(text.slice(0, root.index) + sized + text.slice(root.index + root[0].length), 'utf8');
}

async function download(url, ext) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== TYPES[ext]) throw new Error(`${url}: content type "${type}", expected ${TYPES[ext]}`);
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error(`${url}: larger than ${MAX_BYTES} bytes`);
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error(`${url}: larger than ${MAX_BYTES} bytes`);
    chunks.push(chunk);
  }
  return checked(url, ext, Buffer.concat(chunks));
}

// One file per distinct URL, named after the first thing that uses it; a later URL for the same name gets a number.
const files = new Map();
const taken = new Set();
for (const { name, url } of wanted) {
  if (files.has(url)) continue;
  const ext = extension(url);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  let file = `${slug}.${ext}`;
  for (let copy = 2; taken.has(file); copy += 1) file = `${slug}-${copy}.${ext}`;
  taken.add(file);
  files.set(url, { name, file, ext });
}

const previous = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const vendored = [];
for (const [url, { name, file, ext }] of files) {
  const kept = previous[url] && path.join(OUT, path.basename(previous[url]));
  const bytes = kept && fs.existsSync(kept) ? checked(url, ext, fs.readFileSync(kept)) : await download(url, ext);
  vendored.push({ name, url, file, bytes, fetched: !(kept && fs.existsSync(kept)) });
}

fs.mkdirSync(OUT, { recursive: true });
for (const { file, bytes } of vendored) {
  const target = path.join(OUT, file);
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(bytes)) fs.writeFileSync(target, bytes);
}
const manifest = Object.fromEntries(vendored.map(({ url, file }) => [url, `/icons/${file}`]));
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
for (const file of fs.readdirSync(OUT)) {
  if (file !== 'manifest.json' && !taken.has(file)) { fs.rmSync(path.join(OUT, file)); console.log(`removed  /icons/${file}`); }
}
for (const { name, url, file, bytes, fetched } of vendored) console.log(`${fetched ? 'fetched' : 'kept   '}  /icons/${file.padEnd(22)} ${String(bytes.length).padStart(6)} B  ${name}  ${url}`);
console.log(`${vendored.length} icons in public/icons, manifest at public/icons/manifest.json`);
