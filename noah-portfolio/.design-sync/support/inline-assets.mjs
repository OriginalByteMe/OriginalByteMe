// Make the preview corpus fully self-contained: fetch every image it
// references and inline it as a data URI. SVGs are embedded verbatim; raster
// images (jpeg/png/gif) are downscaled through headless chromium's canvas so
// the bundle stays lean. Local "/x" paths resolve to the repo's committed
// public assets over the jsdelivr GitHub CDN (same source the app ships).
//
// Runs at sync time only. The result (corpus.json) is imported by the preview
// provider, so preview cards render with real icons/covers and NO network —
// which is why capture no longer hangs on unreachable CDNs, and why the design
// pane renders them identically.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const PUBLIC_BASE =
  "https://cdn.jsdelivr.net/gh/OriginalByteMe/OriginalByteMe@main/noah-portfolio/public";
const MAX_DIM = 640; // px — cover images never render larger than this in a card
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const tmp = mkdtempSync(join(tmpdir(), "ds-assets-"));
const corpus = JSON.parse(readFileSync(".design-sync/support/corpus.json", "utf8"));

function absUrl(src) {
  if (typeof src !== "string" || !src) return null;
  if (/^data:/.test(src)) return null; // already inline
  if (/^https?:/.test(src)) return src;
  if (src.startsWith("/")) return PUBLIC_BASE + encodeURI(src);
  return null;
}

// Collect unique image URLs across the corpus. Preview cards render in light
// mode (useIsDark defaults false), so only the LIGHT variant is ever shown —
// mirror dark→light after inlining and never fetch the dark files.
const urls = new Set();
const c = corpus.corpus;
for (const p of c.projects ?? []) {
  [p.image].forEach((u) => absUrl(u) && urls.add(absUrl(u)));
  for (const t of p.technologies ?? []) absUrl(t.lightIcon) && urls.add(absUrl(t.lightIcon));
}
for (const cat of c.skills ?? []) for (const s of cat.skills ?? []) absUrl(s.lightImage) && urls.add(absUrl(s.lightImage));
for (const o of c.operatingSystems ?? []) for (const s of o.systems ?? []) absUrl(s.lightImage) && urls.add(absUrl(s.lightImage));
for (const j of c.careerTimeline ?? []) absUrl(j.logo) && urls.add(absUrl(j.logo));

console.error(`fetching ${urls.size} images…`);

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
const map = new Map(); // url -> dataURI

let i = 0;
for (const url of urls) {
  i++;
  const isSvg = /\.svg(\?|$)/i.test(url);
  const file = join(tmp, `a${i}`);
  try {
    execFileSync("curl", ["-sSL", "--max-time", "30", "-o", file, url], { stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    console.error(`  ! fetch failed: ${url}`);
    continue;
  }
  const buf = readFileSync(file);
  if (!buf.length) { console.error(`  ! empty: ${url}`); continue; }
  if (isSvg) {
    map.set(url, `data:image/svg+xml;base64,${buf.toString("base64")}`);
  } else {
    // Downscale raster (incl. first gif frame) via canvas → jpeg.
    const srcDataUri = `data:application/octet-stream;base64,${buf.toString("base64")}`;
    const out = await page.evaluate(
      async ([src, maxDim]) =>
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            const cv = document.createElement("canvas");
            cv.width = w; cv.height = h;
            const ctx = cv.getContext("2d");
            ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            resolve(cv.toDataURL("image/jpeg", 0.82));
          };
          img.onerror = () => resolve(null);
          img.src = src;
        }),
      [srcDataUri, MAX_DIM],
    );
    if (out) map.set(url, out);
    else console.error(`  ! decode failed: ${url}`);
  }
}
await browser.close();

// Rewrite corpus fields to data URIs (drop light/dark distinction to the light
// variant — preview cards render in light mode).
const rw = (u) => (u && map.get(absUrl(u))) || u;
for (const p of c.projects ?? []) {
  p.image = rw(p.image);
  for (const t of p.technologies ?? []) { t.lightIcon = rw(t.lightIcon); t.darkIcon = t.lightIcon; }
}
for (const cat of c.skills ?? []) for (const s of cat.skills ?? []) { s.lightImage = rw(s.lightImage); s.darkImage = s.lightImage; }
for (const o of c.operatingSystems ?? []) for (const s of o.systems ?? []) { s.lightImage = rw(s.lightImage); s.darkImage = s.lightImage; }
for (const j of c.careerTimeline ?? []) j.logo = rw(j.logo);

writeFileSync(".design-sync/support/corpus.json", JSON.stringify(corpus));
console.error(`inlined ${map.size}/${urls.size} images → corpus.json (${(JSON.stringify(corpus).length / 1024).toFixed(0)} KB)`);
