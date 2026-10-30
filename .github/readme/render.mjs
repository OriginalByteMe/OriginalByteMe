#!/usr/bin/env node
// Renders the live-data SVG cards for the profile README.
//   GITHUB_TOKEN=... node .github/readme/render.mjs <outDir>
// Zero dependencies (Node 24, built-in fetch). Any HTTP/GraphQL problem exits
// non-zero before a single file is written, so a bad run never publishes.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// "Nocturne" palette (docs/design-contract.md section 6.2)
const C = {
  body: "#141319",
  bar: "#211f29",
  text: "#e9e6f2",
  text2: "#b3acce",
  violet: "#9d8ff2",
  blue: "#6ea3e8",
  pink: "#ef9cc2",
  mint: "#7fe0bd",
};
const LANG_COLORS = [C.violet, C.blue, C.pink, C.mint, C.text2];
const OTHER_COLOR = C.text; // drawn at 45% opacity
const FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace";

const EXCLUDED_LANGUAGES = new Set(["Jupyter Notebook"]);

// ---------------------------------------------------------------- pure helpers

export function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Greedy word wrap. A word longer than `max` keeps its own unbroken line.
 * @returns {string[]}
 */
export function wrapText(text, max) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line === "") line = word;
    else if (line.length + 1 + word.length <= max) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** "9y 10m" / "4m": whole months between createdAt and now (UTC), never negative. */
export function formatUptime(createdAt, now = new Date()) {
  const c = new Date(createdAt);
  let months =
    (now.getUTCFullYear() - c.getUTCFullYear()) * 12 + now.getUTCMonth() - c.getUTCMonth();
  if (now.getUTCDate() < c.getUTCDate()) months--;
  months = Math.max(0, months);
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `${y}y ${m}m` : `${m}m`;
}

/** Repos whose pushedAt falls within the last `years` years before `now`. */
export function recentRepos(repos, now, years = 3) {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return repos.filter((r) => new Date(r.pushedAt) >= cutoff);
}

/**
 * Top languages by bytes across repos, plus "Other" when more than `top` remain.
 * Percents are whole numbers that sum to exactly 100 (largest remainder).
 * @param {{languages: {name: string, size: number}[]}[]} repos
 * @returns {{name: string, percent: number, bytes: number}[]}
 */
export function aggregateLanguages(repos, { top = 5, exclude = EXCLUDED_LANGUAGES } = {}) {
  const totals = new Map();
  for (const repo of repos) {
    for (const { name, size } of repo.languages) {
      if (exclude.has(name)) continue;
      totals.set(name, (totals.get(name) ?? 0) + size);
    }
  }
  const ranked = [...totals]
    .map(([name, bytes]) => ({ name, bytes }))
    .filter((l) => l.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
  if (ranked.length === 0) return [];

  const shown = ranked.slice(0, top);
  const other = ranked.slice(top).reduce((sum, l) => sum + l.bytes, 0);
  if (other > 0) shown.push({ name: "Other", bytes: other });

  const total = shown.reduce((sum, l) => sum + l.bytes, 0);
  const floors = shown.map((l) => Math.floor((l.bytes * 100) / total));
  const order = shown
    .map((l, i) => ({ i, rem: (l.bytes * 100) % total }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  let leftover = 100 - floors.reduce((a, b) => a + b, 0);
  for (const { i } of order) {
    if (leftover-- <= 0) break;
    floors[i]++;
  }
  return shown.map((l, i) => ({ name: l.name, percent: floors[i], bytes: l.bytes }));
}

/** Integer x/width per segment from the (rounded) percents, summing exactly to `width`. */
export function barSegments(languages, width) {
  let cumulative = 0;
  return languages.map((l) => {
    const x = Math.round((cumulative * width) / 100);
    cumulative += l.percent;
    return { ...l, x, width: Math.round((cumulative * width) / 100) - x };
  });
}

// ---------------------------------------------------------------- SVG building

const num = (n) => Number(n.toFixed(2));

function chrome({ id, width, height, title, summary, body, css = "" }) {
  const w = width;
  const h = height;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-t ${id}-d">
<title id="${id}-t">${escapeXml(title)}</title>
<desc id="${id}-d">${escapeXml(summary)}</desc>
<style>
text{font-family:${FONT};font-size:15px;fill:${C.text}}
.s{fill:${C.text2}}
.f{fill:rgba(233,230,242,0.45)}
.l{font-size:13px}
.k{fill:${C.violet};font-weight:700}
.b{font-weight:700}
${css}</style>
<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="${C.body}" stroke="rgba(255,255,255,0.10)"/>
<path d="M0.5 36.5 V12.5 A12 12 0 0 1 12.5 0.5 H${w - 12.5} A12 12 0 0 1 ${w - 0.5} 12.5 V36.5 Z" fill="${C.bar}" stroke="rgba(255,255,255,0.10)"/>
<circle cx="20" cy="18" r="6" fill="${C.pink}"/>
<circle cx="40" cy="18" r="6" fill="${C.violet}"/>
<circle cx="60" cy="18" r="6" fill="${C.mint}"/>
<text x="${w / 2}" y="23" text-anchor="middle" class="s l">${escapeXml(title)}</text>
${body}
</svg>
`;
}

const text = (x, y, content, cls = "", extra = "") =>
  `<text x="${x}" y="${y}"${cls ? ` class="${cls}"` : ""}${extra}>${content}</text>`;

function starPoints(cx, cy, outer, inner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${num(cx + r * Math.cos(a))},${num(cy + r * Math.sin(a))}`);
  }
  return pts.join(" ");
}

const promptSpans = `<tspan fill="${C.mint}">noah@originalbyteme</tspan><tspan fill="${C.text2}">:</tspan><tspan fill="${C.violet}">~</tspan><tspan fill="${C.text2}">$ </tspan>`;

/**
 * @param {object} d
 * @param {string} d.createdAt ISO timestamp
 * @param {number} d.repos @param {number} d.stars @param {number} d.commits
 * @param {number} d.prs @param {number} d.followers
 * @param {{name:string, percent:number, bytes:number}[]} d.languages
 * @param {string[]} logoLines
 * @param {Date} now
 */
export function renderNeofetch(d, logoLines, now = new Date()) {
  const W = 840;
  const LEFT = 24;
  const VX = 408; // value column x
  const KX = 290; // info column x
  const WRAP = 44; // value chars per line
  let step = 0;
  const reveal = (ms) => ` style="animation-delay:${ms}ms"`;
  const out = [];

  out.push(
    `<g class="ln"${reveal(0)}>${text(LEFT, 66, `${promptSpans}<tspan>neofetch</tspan>`)}</g>`,
  );

  logoLines.forEach((line, i) => {
    out.push(
      `<g class="ln"${reveal(120 + i * 30)}><text x="${LEFT}" y="${100 + i * 17}" xml:space="preserve" fill="${C.violet}">${escapeXml(line)}</text></g>`,
    );
  });

  const infoStart = 300;
  const infoStep = 55;
  const next = () => infoStart + step++ * infoStep;

  out.push(
    `<g class="ln"${reveal(next())}>${text(KX, 100, `<tspan fill="${C.mint}">noah</tspan><tspan fill="${C.text2}">@</tspan><tspan fill="${C.mint}">originalbyteme</tspan>`, "b")}<line x1="${KX}" y1="110" x2="${KX + 171}" y2="110" stroke="${C.text2}" stroke-width="1.5" stroke-dasharray="6 4"/></g>`,
  );

  const rows = [
    ["Role", "Senior AI Engineer @ MerchantSpring"],
    ["Location", "Kuala Lumpur, Malaysia"],
    ["Uptime", `${formatUptime(d.createdAt, now)} on GitHub`],
    ["Stack", "Rails, Python, TypeScript, Next.js"],
    ["AI tools", "LangChain, Langfuse, Ollama, OpenRouter"],
    ["Homelab", "Proxmox + Unraid"],
    ["Side quest", "CAD & 3D printing @ Bowiq"],
    ["Repos", `${d.repos} public`],
    ["Stars", String(d.stars)],
    ["Commits", `${d.commits} in the last year`],
    ["PRs", `${d.prs} merged, all-time`],
    ["Followers", String(d.followers)],
  ];
  let y = 136;
  for (const [key, value] of rows) {
    const lines = wrapText(value, WRAP);
    const spans = lines
      .map((l, i) => text(VX, y + i * 22, escapeXml(l)))
      .join("");
    out.push(`<g class="ln"${reveal(next())}>${text(KX, y, escapeXml(key), "k")}${spans}</g>`);
    y += lines.length * 22;
  }

  // language bar
  const barY = y + 24;
  const barW = W - 2 * LEFT;
  const segs = barSegments(d.languages, barW);
  const color = (name, i) => (name === "Other" ? OTHER_COLOR : LANG_COLORS[i]);
  const opacity = (name) => (name === "Other" ? ' fill-opacity="0.45"' : "");
  let bar = "";
  if (segs.length > 0) {
    bar += `<clipPath id="bar"><rect x="${LEFT}" y="${barY}" width="${barW}" height="14" rx="7"/></clipPath><g clip-path="url(#bar)">`;
    segs.forEach((s, i) => {
      bar += `<rect x="${LEFT + s.x}" y="${barY}" width="${s.width}" height="14" fill="${color(s.name, i)}"${opacity(s.name)}/>`;
    });
    bar += "</g>";
    let lx = LEFT;
    segs.forEach((s, i) => {
      const label = `${s.name} ${s.percent}%`;
      bar += `<circle cx="${num(lx + 5)}" cy="${barY + 34}" r="5" fill="${color(s.name, i)}"${opacity(s.name)}/>`;
      bar += text(num(lx + 16), barY + 39, escapeXml(label), "s l");
      lx += 16 + label.length * 8 + 22;
    });
  }
  out.push(
    `<g class="ln"${reveal(next())}>${text(LEFT, barY - 8, "languages by bytes, repos pushed in the last 3 years", "f l")}${bar}</g>`,
  );

  // colour-block swatches
  const swY = barY + 62;
  const swatches = [C.violet, C.blue, C.pink, C.mint, C.text2, C.text]
    .map((c, i) => `<rect x="${LEFT + i * 44}" y="${swY}" width="40" height="18" rx="3" fill="${c}"/>`)
    .join("");
  out.push(`<g class="ln"${reveal(next())}>${swatches}</g>`);

  // idle prompt with a blinking caret
  const promptY = swY + 50;
  out.push(
    `<g class="ln"${reveal(next())}>${text(LEFT, promptY, `${promptSpans}<tspan class="caret">_</tspan>`)}</g>`,
  );

  const H = promptY + 24;
  const css = `.ln{animation:in .3s ease-out both}
@keyframes in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.caret{animation:blink 1.1s steps(1) infinite}
@keyframes blink{0%{fill:${C.violet}}50%{fill:transparent}}
@media (prefers-reduced-motion:reduce){.ln,.caret{animation:none}}
`;
  const summary = `neofetch-style summary for Noah Rijkaard: ${rows
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ")}. Top languages: ${d.languages.map((l) => `${l.name} ${l.percent}%`).join(", ") || "none"}.`;
  return chrome({
    id: "nf",
    width: W,
    height: H,
    title: "noah@originalbyteme: ~ neofetch",
    summary,
    body: out.join("\n"),
    css,
  });
}

export function renderProjectCard(project, live, langColor) {
  const W = 410;
  const H = 150;
  const lines = wrapText(project.blurb, 38);
  if (lines.length > 2) {
    throw new Error(`blurb for ${project.slug} needs ${lines.length} lines (max 2): "${project.blurb}"`);
  }
  const lang = live.language ?? "Unknown";
  const count = String(live.stars);
  const starCx = W - 24 - count.length * 8 - 16;
  const body = [
    text(24, 66, escapeXml(project.title), "b", ' style="font-size:16px"'),
    ...lines.map((l, i) => text(24, 92 + i * 20, escapeXml(l), "s")),
    `<circle cx="29" cy="130" r="5" fill="${langColor}"/>`,
    text(40, 135, escapeXml(lang), "s l"),
    ...(live.stars > 0
      ? [
          `<polygon points="${starPoints(starCx, 130, 7, 3)}" fill="${C.text2}"/>`,
          text(W - 24, 135, count, "s l", ' text-anchor="end"'),
        ]
      : []),
  ].join("\n");
  return chrome({
    id: "pc",
    width: W,
    height: H,
    title: `~/projects/${project.dir}`,
    summary: `${project.title}: ${project.blurb} Primary language ${lang}${live.stars > 0 ? `, ${count} stars on GitHub` : ""}.`,
    body,
  });
}

// ---------------------------------------------------------------- data

const PROJECTS = [
  { file: "project-ask-me.svg", slug: "OriginalByteMe/OriginalByteMe", dir: "ask-me", title: "Ask-Me Portfolio", blurb: "Ask anything and an LLM builds a whole website to answer it." },
  { file: "project-llm-comparison.svg", slug: "Supahands/llm-comparison", dir: "llm-comparison", title: "LLM Comparison", blurb: "Open-source app that pits two LLMs against each other, head to head." },
  { file: "project-ai-cutout.svg", slug: "OriginalByteMe/AI_Image_cutout_maker", dir: "AI_Image_cutout_maker", title: "AI Image Cutout Maker", blurb: "Cuts people and objects out of images as stickers with Segment Anything." },
  { file: "project-moodify.svg", slug: "OriginalByteMe/Moodify", dir: "Moodify", title: "Moodify", blurb: "Search a tune and its album cover's colour palette takes over the page." },
  { file: "project-obsidian-brain.svg", slug: "OriginalByteMe/The-Obsidian-Brain-MCP", dir: "The-Obsidian-Brain-MCP", title: "The Obsidian Brain MCP", blurb: "MCP server that lets an LLM search and organise your Obsidian vault." },
  { file: "project-kobodash.svg", slug: "OriginalByteMe/kobodash", dir: "kobodash", title: "kobodash", blurb: "Turn a Kobo e-reader into a wireless e-ink dashboard." },
];

function buildQuery() {
  const repoFields = "stargazerCount primaryLanguage { name }";
  const aliases = PROJECTS.map((p, i) => {
    const [owner, name] = p.slug.split("/");
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${repoFields} }`;
  }).join("\n  ");
  return `query ($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
      totalCount
      pageInfo { hasNextPage }
      nodes {
        stargazerCount
        pushedAt
        languages(first: 20, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name } } }
      }
    }
    contributionsCollection { totalCommitContributions }
    pullRequests(states: MERGED) { totalCount }
  }
  ${aliases}
}`;
}

export async function fetchStats(token, login, now = new Date()) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "originalbyteme-readme-render",
    },
    body: JSON.stringify({ query: buildQuery(), variables: { login } }),
  });
  if (!res.ok) {
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`GitHub GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  const { data } = json;
  const user = data?.user;
  if (!user) throw new Error(`GitHub user "${login}" not found in GraphQL response`);
  if (user.repositories.pageInfo.hasNextPage) {
    throw new Error("more than 100 public repos: add pagination before trusting the totals");
  }

  const repos = user.repositories.nodes;
  const projects = PROJECTS.map((p, i) => {
    const r = data[`r${i}`];
    if (!r) throw new Error(`project repo ${p.slug} not found (renamed, deleted or private?)`);
    return { stars: r.stargazerCount, language: r.primaryLanguage?.name ?? null };
  });
  return {
    createdAt: user.createdAt,
    followers: user.followers.totalCount,
    repos: user.repositories.totalCount,
    stars: repos.reduce((sum, r) => sum + r.stargazerCount, 0),
    commits: user.contributionsCollection.totalCommitContributions,
    prs: user.pullRequests.totalCount,
    languages: aggregateLanguages(
      recentRepos(repos, now).map((r) => ({
        languages: r.languages.edges.map((e) => ({ name: e.node.name, size: e.size })),
      })),
    ),
    projects,
  };
}

// ---------------------------------------------------------------- CLI

async function main() {
  const outDir = process.argv[2];
  if (!outDir) throw new Error("usage: node render.mjs <outDir>");
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");
  const login = process.env.GITHUB_USER || "OriginalByteMe";

  const logo = (await readFile(path.join(HERE, "logo.txt"), "utf8")).trimEnd().split("\n");
  const now = new Date();
  const stats = await fetchStats(token, login, now);

  const langColor = new Map(
    stats.languages.map((l, i) => [l.name, l.name === "Other" ? null : LANG_COLORS[i]]),
  );
  const files = [{ file: "neofetch.svg", svg: renderNeofetch(stats, logo, now) }];
  PROJECTS.forEach((p, i) => {
    const live = stats.projects[i];
    files.push({
      file: p.file,
      svg: renderProjectCard(p, live, langColor.get(live.language) ?? C.text2),
    });
  });

  await mkdir(outDir, { recursive: true });
  for (const { file, svg } of files) await writeFile(path.join(outDir, file), svg);
  console.log(`wrote ${files.length} SVGs to ${outDir}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`render failed: ${err.message}`);
    process.exit(1);
  });
}
