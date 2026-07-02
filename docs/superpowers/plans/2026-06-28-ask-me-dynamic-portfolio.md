# Ask-Me Dynamic Portfolio — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the portfolio re-compose itself around a visitor's question — a hero chat box generates a json-render spec (OpenRouter, streamed) that animates the page body from a catalog of Noah's own (adapted) components, grounded in a markdown corpus, with Cloudflare KV caching.

**Architecture:** A persistent React shell (lava-lamp bg, theme, header, hero+chat) wraps a single json-render canvas. The canvas renders either a hand-authored `homeSpec` (the current page, rebuilt by *adapting existing components* into the registry) or a streamed answer spec. Facts live in a json-render `StateStore` at `/corpus/*` (parsed from `content/about-me/*.md` frontmatter); the model emits structure + literal `/corpus/*` `statePath` pointers + prose only (fact components resolve their `statePath` via `useStateValue`; specs never use a `$state` binding). Repeat questions are served from CF KV.

**Tech Stack:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind 3.4 · `@json-render/core` + `@json-render/react` · `framer-motion` · Vercel AI SDK (`ai`) + `@openrouter/ai-sdk-provider` (model `deepseek/deepseek-v4-flash`) · `gray-matter` · Cloudflare Workers KV (REST).

**Design spec:** `docs/superpowers/specs/2026-06-28-ask-me-dynamic-portfolio-design.md` (repo root).

## Global Constraints

- **Next.js App Router, React 18, TS strict.** All client components need `"use client"`. The API route is a Route Handler (`app/api/generate/route.ts`), runtime `nodejs` (needs fs at build + KV fetch).
- **Corpus is loaded at build/import time** from `content/about-me/**` via `fs` + `gray-matter` — never at request time. Keep `content/` inside `noah-portfolio/`.
- **Model is config, not hardcoded:** read slug from `OPENROUTER_MODEL` (default `deepseek/deepseek-v4-flash`).
- **Env vars:** `OPENROUTER_API_KEY` (required), `OPENROUTER_MODEL` (optional), `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_KV_TOKEN` (cache; if absent, cache is a no-op — never crash).
- **No rate limiter.** Input cap = 280 chars. On any LLM/spec error → fall back to `homeSpec`, never blank.
- **Cache key** = `normalizeQuestion(q) + ":" + CATALOG_VERSION`. Bump `CATALOG_VERSION` on any catalog/schema change.
- **Reuse, don't redesign:** registry impls lift the existing `Hero`/`About`/`Projects`/`Contact` JSX/Tailwind verbatim, refactored only to take data via props (fact blocks receive a literal `statePath` pointer they resolve with `useStateValue`). Reuse `lib/hooks/useTheme.ts`, `components/ui/frosted-glass-box`, `components/ui/spotify-reveal`.
- **PRE-FLIGHT (do before Task 9+):** json-render is fast-moving — after install, open the installed `@json-render/react` and `@json-render/core` `.d.ts` files and confirm the exact signatures of `defineRegistry`, `Renderer`, `useUIStream`, `createSpecStreamCompiler`, `createJsonRenderTransform`, `StateProvider`, `createStateStore`, `buildUserPrompt`, `catalog.prompt`, `validateSpec`, `autoFixSpec`. The code below targets the documented surface; reconcile any signature drift before writing streaming code.
- **TDD:** Vitest + React Testing Library for unit/component; Playwright for E2E. Mock the model and KV in tests — no live-LLM calls in CI.

---

### Task 1: Dependencies, env validation, test harness

**Files:**
- Modify: `noah-portfolio/package.json` (deps + test scripts)
- Create: `noah-portfolio/.env.local.example`
- Create: `noah-portfolio/lib/env.ts`
- Create: `noah-portfolio/vitest.config.ts`, `noah-portfolio/vitest.setup.ts`
- Test: `noah-portfolio/lib/__tests__/env.test.ts`

**Interfaces:**
- Produces: `getServerEnv(): { openrouterApiKey: string; openrouterModel: string; cf?: { accountId; namespaceId; token } }` from `lib/env.ts`.

- [ ] **Step 1: Install deps**

```bash
cd noah-portfolio
npm i @json-render/core @json-render/react framer-motion ai @openrouter/ai-sdk-provider gray-matter zod
npm i -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test
```

- [ ] **Step 2: Add test scripts to `package.json`**

```json
"scripts": {
  "dev": "NODE_OPTIONS='--inspect' next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "e2e": "playwright test"
}
```

- [ ] **Step 3: Vitest config**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"], globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```
```ts
// vitest.setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write failing test for env**

```ts
// lib/__tests__/env.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getServerEnv } from "@/lib/env";

describe("getServerEnv", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "test-key"; delete process.env.OPENROUTER_MODEL; });
  it("defaults the model when unset", () => {
    expect(getServerEnv().openrouterModel).toBe("deepseek/deepseek-v4-flash");
  });
  it("throws when the API key is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => getServerEnv()).toThrow(/OPENROUTER_API_KEY/);
  });
  it("returns cf config only when all three CF vars are present", () => {
    expect(getServerEnv().cf).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run — expect FAIL** (`npm test -- env`) — "Cannot find module '@/lib/env'".

- [ ] **Step 6: Implement `lib/env.ts`**

```ts
export function getServerEnv() {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");
  const openrouterModel = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
  const { CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_KV_TOKEN } = process.env;
  const cf = CF_ACCOUNT_ID && CF_KV_NAMESPACE_ID && CF_KV_TOKEN
    ? { accountId: CF_ACCOUNT_ID, namespaceId: CF_KV_NAMESPACE_ID, token: CF_KV_TOKEN }
    : undefined;
  return { openrouterApiKey, openrouterModel, cf };
}
```

- [ ] **Step 7: `.env.local.example`**

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
CF_ACCOUNT_ID=
CF_KV_NAMESPACE_ID=
CF_KV_TOKEN=
```

- [ ] **Step 8: Run — expect PASS**, then commit.

```bash
git add package.json package-lock.json vitest.config.ts vitest.setup.ts lib/env.ts lib/__tests__/env.test.ts .env.local.example
git commit -m "chore: add json-render/openrouter deps, env validation, vitest harness"
```

---

### Task 2: Corpus — types, markdown seed, loader

**Files:**
- Create: `noah-portfolio/lib/corpus/types.ts`
- Create: `noah-portfolio/content/about-me/{bio,career,skills,operating-systems,contact,fun-facts}.md`, `content/about-me/projects/{ai-image-cutout,llm-comparison}.md`
- Create: `noah-portfolio/lib/corpus/loader.ts`, `noah-portfolio/lib/corpus/index.ts`
- Test: `noah-portfolio/lib/corpus/__tests__/loader.test.ts`

**Interfaces:**
- Produces: types `Bio, Job, SkillCategory, OperatingSystem, Project, Contact, FunFact`; `Corpus = { bio; careerTimeline: Job[]; skills: SkillCategory[]; operatingSystems: OperatingSystem[]; projects: Project[]; contact: Contact; funFacts: FunFact[] }`; `loadCorpus(dir?): { corpus: Corpus; knowledge: string }`; `corpusState(): Record<string, unknown>` (keys = `/corpus/<field>`); `knowledge(): string`; `corpusSnapshot(): string`.

- [ ] **Step 1: Types** — `lib/corpus/types.ts`

```ts
export interface IconRef { name: string; lightImage: string; darkImage: string }
export interface SkillCategory { category: string; skills: IconRef[] }
export interface OperatingSystem { name: string; systems: IconRef[] }
export interface Job { company: string; role: string; period: string; logo: string; url: string; highlights?: string[] }
export interface ProjectTech { name: string; lightIcon: string; darkIcon: string }
export interface Project { slug: string; title: string; description: string; image: string; url: string; technologies: ProjectTech[] }
export interface Contact { email: string; github: string; linkedin: string; blog?: string }
export interface Bio { headline: string; location: string }
export interface FunFact { text: string }
export interface Corpus {
  bio: Bio; careerTimeline: Job[]; skills: SkillCategory[];
  operatingSystems: OperatingSystem[]; projects: Project[]; contact: Contact; funFacts: FunFact[];
}
```

- [ ] **Step 2: Seed markdown** — extract the *exact* current data into frontmatter. Example (`content/about-me/career.md`), using the real values from `components/About.tsx:217-233`:

```markdown
---
jobs:
  - company: "Supa"
    role: "Full-Stack Developer"
    period: "2020 - Present"
    logo: "https://cdn.prod.website-files.com/63024b20439fa61d4aee344c/63030911c32fa796ec211265_SUPA.png"
    url: "https://supa.so"
  - company: "Bowiq"
    role: "CAD Designer & 3D Printing Engineer"
    period: "2023 - Present"
    logo: "https://bowiq.com/wp-content/themes/bowiq/img/local/logov2.png"
    url: "https://bowiq.com"
---
Noah is a full-stack software engineer based in Kuala Lumpur, Malaysia, working across backend, infra, and frontend. He leans toward self-hosting, Docker, and pragmatic scalable systems.
```

Do the same, copying values verbatim from the source:
- `skills.md` frontmatter `skills:` ← the four categories in `About.tsx:18-167` (each `{ category, skills:[{name,lightImage,darkImage}] }`).
- `operating-systems.md` `operatingSystems:` ← `About.tsx:169-215`.
- `projects/ai-image-cutout.md` + `projects/llm-comparison.md` ← the two entries in `Projects.tsx:7-103` (add a `slug`), prose body = the `description`.
- `contact.md` `contact:` ← `{ email: "noahrijkaard@gmail.com", github: "https://github.com/OriginalByteMe", linkedin: "https://www.linkedin.com/in/noah-rijkaard/", blog: "https://blog.noahrijkaard.com" }` (from `Contact.tsx`).
- `bio.md` `bio:` ← `{ headline: "Full-Stack Developer", location: "Kuala Lumpur, Malaysia" }`; prose = the About paragraph (`About.tsx:264-267`).
- `fun-facts.md` `funFacts:` ← `[{ text: "Into 3D printing / CAD (FDM, high-end materials)" }, { text: "Self-hosts on Proxmox + Unraid" }]` (from About side-projects).

- [ ] **Step 3: Failing loader test** — `lib/corpus/__tests__/loader.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { loadCorpus } from "@/lib/corpus/loader";

describe("loadCorpus", () => {
  const { corpus, knowledge } = loadCorpus();
  it("parses career frontmatter into typed jobs", () => {
    expect(corpus.careerTimeline.map((j) => j.company)).toContain("Supa");
  });
  it("parses all skill categories", () => {
    expect(corpus.skills.length).toBeGreaterThanOrEqual(4);
  });
  it("loads each project with a slug", () => {
    expect(corpus.projects.every((p) => p.slug && p.technologies.length > 0)).toBe(true);
  });
  it("collects prose bodies into knowledge", () => {
    expect(knowledge).toMatch(/Kuala Lumpur/);
  });
});
```

- [ ] **Step 4: Run — expect FAIL.**

- [ ] **Step 5: Implement `lib/corpus/loader.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Corpus } from "./types";

const ROOT = path.join(process.cwd(), "content", "about-me");

function read(file: string) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return { data: {} as Record<string, unknown>, content: "" };
  return matter(fs.readFileSync(full, "utf8"));
}

export function loadCorpus(): { corpus: Corpus; knowledge: string } {
  const bioF = read("bio.md");
  const careerF = read("career.md");
  const skillsF = read("skills.md");
  const osF = read("operating-systems.md");
  const contactF = read("contact.md");
  const funF = read("fun-facts.md");

  const projectsDir = path.join(ROOT, "projects");
  const projectFiles = fs.existsSync(projectsDir) ? fs.readdirSync(projectsDir).filter((f) => f.endsWith(".md")) : [];
  const projects = projectFiles.map((f) => {
    const p = matter(fs.readFileSync(path.join(projectsDir, f), "utf8"));
    return { slug: f.replace(/\.md$/, ""), ...(p.data as any), description: (p.data as any).description ?? p.content.trim() };
  });

  const corpus: Corpus = {
    bio: (bioF.data as any).bio ?? { headline: "", location: "" },
    careerTimeline: (careerF.data as any).jobs ?? [],
    skills: (skillsF.data as any).skills ?? [],
    operatingSystems: (osF.data as any).operatingSystems ?? [],
    projects: projects as any,
    contact: (contactF.data as any).contact ?? { email: "", github: "", linkedin: "" },
    funFacts: (funF.data as any).funFacts ?? [],
  };

  const knowledge = [bioF, careerF, skillsF, osF, contactF, funF]
    .map((f) => f.content.trim()).filter(Boolean).join("\n\n");

  return { corpus, knowledge };
}
```

- [ ] **Step 6: Implement `lib/corpus/index.ts`**

```ts
import { loadCorpus } from "./loader";

const { corpus, knowledge: prose } = loadCorpus();

export function corpusState(): Record<string, unknown> {
  return {
    "/corpus/bio": corpus.bio,
    "/corpus/careerTimeline": corpus.careerTimeline,
    "/corpus/skills": corpus.skills,
    "/corpus/operatingSystems": corpus.operatingSystems,
    "/corpus/projects": corpus.projects,
    "/corpus/contact": corpus.contact,
    "/corpus/funFacts": corpus.funFacts,
  };
}
export function knowledge(): string { return prose; }
export function corpusSnapshot(): string { return JSON.stringify(corpus); }
export { corpus };
```

- [ ] **Step 7: Run — expect PASS**, then commit.

```bash
git add content/about-me lib/corpus
git commit -m "feat(corpus): markdown knowledge base + typed loader (seed from existing data)"
```

---

### Task 3: json-render schema + catalog

**Files:**
- Create: `noah-portfolio/lib/jsonui/schema.ts`, `lib/jsonui/catalog.ts`, `lib/jsonui/catalogVersion.ts`
- Test: `noah-portfolio/lib/jsonui/__tests__/catalog.test.ts`

**Interfaces:**
- Produces: `catalog` (from `defineCatalog`), `CATALOG_VERSION: string`. Component names: `Section, Stack, Columns, Grid, Prose, Heading, Callout, Quote, CareerTimeline, ProjectShowcase, SkillGrid, SkillCloud, StatCallout, ContactCard, LottieFigure, SpotifyNowPlaying, ImageBlock, StepFlow`.

- [ ] **Step 1: `catalogVersion.ts`** → `export const CATALOG_VERSION = "v1";`

- [ ] **Step 2: `schema.ts`** → `export { schema } from "@json-render/react/schema";`

- [ ] **Step 3: Failing catalog test**

```ts
import { describe, it, expect } from "vitest";
import { catalog } from "@/lib/jsonui/catalog";

describe("catalog", () => {
  it("exposes the fact-block components", () => {
    const prompt = catalog.prompt();
    for (const name of ["CareerTimeline","ProjectShowcase","SkillGrid","ContactCard","StepFlow"])
      expect(prompt).toContain(name);
  });
  it("ProjectShowcase rejects a missing statePath prop", () => {
    const def = (catalog as any).components.ProjectShowcase.props;
    expect(def.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 4: Run — expect FAIL.**

- [ ] **Step 5: Implement `lib/jsonui/catalog.ts`** (zod props + descriptions; fact-blocks take a literal `statePath` pointer string — e.g. `"/corpus/projects"` — that the component resolves via `useStateValue`, never a `$state` binding). Example shape — define ALL components:

```ts
import { defineCatalog } from "@json-render/core";
import { schema } from "./schema";
import { z } from "zod";

export const catalog = defineCatalog(schema, {
  components: {
    Section:  { props: z.object({ title: z.string().nullable().optional() }), description: "Full-width vertical section with optional heading." },
    Stack:    { props: z.object({ gap: z.enum(["sm","md","lg"]).nullable().optional() }), description: "Vertical stack of children." },
    Columns:  { props: z.object({ count: z.number().min(1).max(3) }), description: "Responsive multi-column grid (1-3)." },
    Grid:     { props: z.object({ cols: z.number().min(1).max(4) }), description: "Card grid." },
    Prose:    { props: z.object({ text: z.string() }), description: "A paragraph of narrative text written by you." },
    Heading:  { props: z.object({ text: z.string(), level: z.number().min(1).max(4) }), description: "Section heading." },
    Callout:  { props: z.object({ text: z.string(), tone: z.enum(["info","success","warn"]).nullable().optional() }), description: "Highlighted callout." },
    Quote:    { props: z.object({ text: z.string(), cite: z.string().nullable().optional() }), description: "Pull quote." },
    CareerTimeline:  { props: z.object({ statePath: z.string() }), description: "Animated company/role timeline. Set statePath to the literal string \"/corpus/careerTimeline\"." },
    ProjectShowcase: { props: z.object({ statePath: z.string(), slug: z.string().nullable().optional() }), description: "Project cards (image, desc, tech, link). Set statePath to the literal string \"/corpus/projects\"; optional slug filters to one." },
    SkillGrid:  { props: z.object({ statePath: z.string() }), description: "Categorized skills grid. Set statePath to the literal string \"/corpus/skills\"." },
    SkillCloud: { props: z.object({ statePath: z.string() }), description: "Compact skill pills. Set statePath to the literal string \"/corpus/skills\"." },
    StatCallout:{ props: z.object({ value: z.string(), label: z.string() }), description: "Big number + label." },
    ContactCard:{ props: z.object({ statePath: z.string() }), description: "Email/GitHub/LinkedIn cards. Set statePath to the literal string \"/corpus/contact\"." },
    LottieFigure:{ props: z.object({ src: z.string(), caption: z.string().nullable().optional() }), description: "Decorative Lottie animation." },
    SpotifyNowPlaying:{ props: z.object({}), description: "Noah's current Spotify track reveal." },
    ImageBlock: { props: z.object({ src: z.string(), alt: z.string(), caption: z.string().nullable().optional() }), description: "Image with caption." },
    StepFlow:   { props: z.object({ steps: z.array(z.object({ title: z.string(), body: z.string() })) }), description: "Animated numbered steps to explain how something works." },
  },
});
```

- [ ] **Step 6: Run — expect PASS**, commit.

```bash
git add lib/jsonui/{schema,catalog,catalogVersion}.ts lib/jsonui/__tests__/catalog.test.ts
git commit -m "feat(jsonui): json-render schema + component catalog with zod props"
```

---

### Task 4: Registry — layout + voice components (framer-motion)

**Files:**
- Create: `noah-portfolio/lib/jsonui/components/primitives.tsx`
- Create: `noah-portfolio/lib/jsonui/motion.ts` (shared variants)
- Test: `noah-portfolio/lib/jsonui/__tests__/primitives.test.tsx`

**Interfaces:**
- Consumes: `catalog` (Task 3), `BaseComponentProps` from `@json-render/react`.
- Produces: `primitiveComponents` map (`Section, Stack, Columns, Grid, Prose, Heading, Callout, Quote`) for `defineRegistry`.

- [ ] **Step 1: Shared motion** — `lib/jsonui/motion.ts`

```ts
import type { Variants } from "framer-motion";
export const enter: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, type: "spring", stiffness: 220, damping: 24 } }),
};
```

- [ ] **Step 2: Failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { primitiveComponents } from "@/lib/jsonui/components/primitives";

it("Prose renders its text", () => {
  const Prose = primitiveComponents.Prose;
  render(<Prose props={{ text: "hello world" }} children={null} />);
  expect(screen.getByText("hello world")).toBeInTheDocument();
});
```

- [ ] **Step 3: Run — expect FAIL.**

- [ ] **Step 4: Implement `primitives.tsx`** (each wraps content in `motion.*` with `enter`; reuse existing Tailwind class conventions from the current sections). Provide all 8:

```tsx
"use client";
import { motion } from "framer-motion";
import type { BaseComponentProps } from "@json-render/react";
import { enter } from "../motion";

export const primitiveComponents = {
  Section: ({ props, children }: BaseComponentProps<{ title?: string | null }>) => (
    <motion.section variants={enter} initial="hidden" animate="show" className="relative py-20">
      <div className="container mx-auto px-4">
        {props.title ? <h2 className="text-3xl font-bold mb-8">{props.title}</h2> : null}
        {children}
      </div>
    </motion.section>
  ),
  Stack: ({ props, children }: BaseComponentProps<{ gap?: "sm"|"md"|"lg"|null }>) => (
    <motion.div variants={enter} initial="hidden" animate="show"
      className={{ sm: "space-y-3", md: "space-y-6", lg: "space-y-12" }[props.gap ?? "md"]}>{children}</motion.div>
  ),
  Columns: ({ props, children }: BaseComponentProps<{ count: number }>) => (
    <div className={`grid gap-12 md:grid-cols-${Math.min(3, props.count)}`}>{children}</div>
  ),
  Grid: ({ props, children }: BaseComponentProps<{ cols: number }>) => (
    <div className={`grid gap-6 grid-cols-1 md:grid-cols-${Math.min(4, props.cols)}`}>{children}</div>
  ),
  Prose: ({ props }: BaseComponentProps<{ text: string }>) => (
    <motion.p variants={enter} initial="hidden" animate="show" className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl">{props.text}</motion.p>
  ),
  Heading: ({ props }: BaseComponentProps<{ text: string; level: number }>) => {
    const Tag = (`h${Math.min(4, Math.max(1, props.level))}`) as "h1";
    return <Tag className="text-2xl font-semibold mb-4">{props.text}</Tag>;
  },
  Callout: ({ props }: BaseComponentProps<{ text: string; tone?: "info"|"success"|"warn"|null }>) => (
    <motion.div variants={enter} initial="hidden" animate="show"
      className="rounded-xl border-l-4 border-blue-500 bg-blue-500/10 p-4">{props.text}</motion.div>
  ),
  Quote: ({ props }: BaseComponentProps<{ text: string; cite?: string | null }>) => (
    <blockquote className="border-l-2 border-gray-300 dark:border-gray-700 pl-4 italic">
      {props.text}{props.cite ? <footer className="text-sm text-gray-500">— {props.cite}</footer> : null}
    </blockquote>
  ),
};
```
> Tailwind dynamic classes (`md:grid-cols-${n}`) must be safelisted — add `safelist: ["md:grid-cols-1","md:grid-cols-2","md:grid-cols-3","md:grid-cols-4"]` to `tailwind.config.ts` in this step.

- [ ] **Step 5: Run — expect PASS**, commit.

```bash
git add lib/jsonui/components/primitives.tsx lib/jsonui/motion.ts lib/jsonui/__tests__/primitives.test.tsx tailwind.config.ts
git commit -m "feat(jsonui): layout + voice primitive components with framer-motion"
```

---

### Task 5: Registry — fact-block components (adapted from existing sections)

**Files:**
- Create: `noah-portfolio/lib/jsonui/components/facts.tsx`
- Test: `noah-portfolio/lib/jsonui/__tests__/facts.test.tsx`

**Interfaces:**
- Consumes: `useStateValue` from `@json-render/react` (read `/corpus/*`), `useTheme` (`lib/hooks/useTheme.ts`), `FrostedGlassBox`, `Job/Project/SkillCategory/Contact` types.
- Produces: `factComponents` map (`CareerTimeline, ProjectShowcase, SkillGrid, SkillCloud, StatCallout, ContactCard`).

> **Adapt, don't invent.** Each impl lifts the matching JSX from the current section and reads its data from the bound `statePath` instead of the inline array. Source references below.

- [ ] **Step 1: Failing test** (binding + render)

```tsx
import { render, screen } from "@testing-library/react";
import { StateProvider, createStateStore } from "@json-render/react";
import { factComponents } from "@/lib/jsonui/components/facts";

it("ProjectShowcase renders titles bound from state", () => {
  const store = createStateStore({ corpus: { projects: [{ slug:"x", title:"AI Image Cutout Tool", description:"d", image:"/i.png", url:"#", technologies:[] }] } });
  const ProjectShowcase = factComponents.ProjectShowcase;
  render(<StateProvider store={store}><ProjectShowcase props={{ statePath: "/corpus/projects" }} children={null} /></StateProvider>);
  expect(screen.getByText("AI Image Cutout Tool")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `facts.tsx`.** For each component, lift the source JSX:
  - **`ProjectShowcase`** ← `components/Projects.tsx:133-177` card markup. Read `projects = useStateValue(props.statePath)`; if `props.slug`, filter to that one. Keep the `<a>`/Image/tech-pill markup verbatim; swap `isDark ? tech.darkIcon : tech.lightIcon` using `useTheme()`.
  - **`SkillGrid`** ← `About.tsx:274-314` (category loop + `FrostedGlassBox` pills + lucide category icons). Read `skills = useStateValue(props.statePath)` (array of `{category, skills[]}`).
  - **`SkillCloud`** ← same data, flattened to a single wrap of pills (compact variant; reuse the `FrostedGlassBox` pill markup without category headers).
  - **`CareerTimeline`** ← `About.tsx:320-364` work-history `<ul>`; read `jobs = useStateValue(props.statePath)`; wrap each `<li>` in `motion.li` with staggered `enter` (custom index).
  - **`ContactCard`** ← `Contact.tsx:11-52` three `FrostedGlassBox` cards; read `contact = useStateValue(props.statePath)` and map email/github/linkedin from it instead of hardcoded hrefs.
  - **`StatCallout`** ← new, small: big `value` + `label`, `motion.div` + `enter`.

  Skeleton (fill each from its source):

```tsx
"use client";
import { motion } from "framer-motion";
import Image from "next/image";
import type { BaseComponentProps } from "@json-render/react";
import { useStateValue } from "@json-render/react";
import { useTheme } from "@/lib/hooks/useTheme";
import FrostedGlassBox from "@/components/ui/frosted-glass-box";
import { enter } from "../motion";
import type { Project, SkillCategory, Job, Contact } from "@/lib/corpus/types";

export const factComponents = {
  ProjectShowcase: ({ props }: BaseComponentProps<{ statePath: string; slug?: string | null }>) => {
    const { isDark } = useTheme();
    const all = (useStateValue(props.statePath) as Project[]) ?? [];
    const projects = props.slug ? all.filter((p) => p.slug === props.slug) : all;
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map((project, i) => (
          <motion.a key={project.slug} custom={i} variants={enter} initial="hidden" animate="show"
            href={project.url} target="_blank" rel="noopener noreferrer"
            className="group bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-lg">
            {/* lift the inner markup from Projects.tsx:141-174 verbatim, using `project` + isDark */}
          </motion.a>
        ))}
      </div>
    );
  },
  // SkillGrid, SkillCloud, CareerTimeline, ContactCard, StatCallout — implement per the source refs above.
};
```

- [ ] **Step 4: Run — expect PASS** (add a render test per component), commit.

```bash
git add lib/jsonui/components/facts.tsx lib/jsonui/__tests__/facts.test.tsx
git commit -m "feat(jsonui): fact-block components adapted from existing sections, state-bound"
```

---

### Task 6: Registry — personality + explainer components

**Files:**
- Create: `noah-portfolio/lib/jsonui/components/extras.tsx`
- Test: `noah-portfolio/lib/jsonui/__tests__/extras.test.tsx`

**Interfaces:**
- Produces: `extraComponents` map (`LottieFigure, SpotifyNowPlaying, ImageBlock, StepFlow`).

- [ ] **Step 1: Failing test** — `StepFlow` renders each step title.

```tsx
import { render, screen } from "@testing-library/react";
import { extraComponents } from "@/lib/jsonui/components/extras";
it("StepFlow renders steps", () => {
  const StepFlow = extraComponents.StepFlow;
  render(<StepFlow props={{ steps: [{ title: "Upload", body: "b" }, { title: "Segment", body: "b" }] }} children={null} />);
  expect(screen.getByText("Upload")).toBeInTheDocument();
  expect(screen.getByText("Segment")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `extras.tsx`:**
  - `LottieFigure` → wrap `DotLottieReact` (`@lottiefiles/dotlottie-react`) with `props.src`, optional caption.
  - `SpotifyNowPlaying` → render the existing `components/ui/spotify-reveal` default export (reuse as-is).
  - `ImageBlock` → `next/image` + caption.
  - `StepFlow` → `motion.ol`; each step `motion.li` with `custom={i}` `enter`, numbered badge + title + body (new component; numbered animated steps).

- [ ] **Step 4: Run — expect PASS**, commit.

```bash
git add lib/jsonui/components/extras.tsx lib/jsonui/__tests__/extras.test.tsx
git commit -m "feat(jsonui): personality + StepFlow explainer components"
```

---

### Task 7: Registry assembly + providers

**Files:**
- Create: `noah-portfolio/lib/jsonui/registry.tsx` (combine all component maps via `defineRegistry`)
- Create: `noah-portfolio/components/JsonUiProvider.tsx` (client; StateProvider seeded from a serializable `initialState` prop + Action/Visibility)
- Modify: `noah-portfolio/app/layout.tsx` (server component) to compute corpus state and mount `JsonUiProvider` around the page, passing it as the `initialState` prop
- Test: `noah-portfolio/lib/jsonui/__tests__/registry.test.tsx`

**Interfaces:**
- Consumes: `primitiveComponents`, `factComponents`, `extraComponents`, `catalog`, `corpusState()`.
- Produces: `registry` (from `defineRegistry`); `JsonUiProvider` client component (accepts a serializable `initialState` prop).

- [ ] **Step 1: Failing test** — render a tiny spec through `Renderer` + `registry` inside the provider; assert a `/corpus/*`-bound component shows a real value.

```tsx
import { render, screen } from "@testing-library/react";
import { Renderer } from "@json-render/react";
import { registry } from "@/lib/jsonui/registry";
import { JsonUiProvider } from "@/components/JsonUiProvider";

it("renders a bound CareerTimeline through the registry", () => {
  // v0.19 spec format is FLAT: root is an element KEY, elements is a keyed map (children = arrays of keys).
  const spec = { root: "t", elements: { t: { type: "CareerTimeline", props: { statePath: "/corpus/careerTimeline" }, children: [] } } };
  const initialState = { "/corpus/careerTimeline": [{ company: "Supa", role: "Full-Stack Developer", period: "2020 - Present", logo: "", url: "#" }] };
  render(<JsonUiProvider initialState={initialState}><Renderer spec={spec as any} registry={registry} /></JsonUiProvider>);
  expect(screen.getByText("Supa")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `registry.tsx`**

```tsx
import { defineRegistry } from "@json-render/react";
import { catalog } from "./catalog";
import { primitiveComponents } from "./components/primitives";
import { factComponents } from "./components/facts";
import { extraComponents } from "./components/extras";

export const { registry } = defineRegistry(catalog, {
  components: { ...primitiveComponents, ...factComponents, ...extraComponents },
});
```

- [ ] **Step 4: Implement `JsonUiProvider.tsx`**

```tsx
"use client";
import { StateProvider, ActionProvider, VisibilityProvider, createStateStore } from "@json-render/react";
import { useMemo } from "react";

// `initialState` is the serializable output of corpusState() (JSON-pointer keys),
// computed in a SERVER component and passed down. Never import @/lib/corpus here:
// "use client" would drag the node:fs corpus loader into the client bundle.
export function JsonUiProvider({
  initialState,
  children,
}: {
  initialState: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const store = useMemo(() => createStateStore(buildInitialState(initialState)), [initialState]);
  return (
    <StateProvider store={store}>
      <ActionProvider><VisibilityProvider>{children}</VisibilityProvider></ActionProvider>
    </StateProvider>
  );
}

// createStateStore takes a plain nested object; corpusState() returns JSON-pointer keys.
function buildInitialState(flat: Record<string, unknown>) {
  const out: any = { corpus: {} };
  for (const [k, v] of Object.entries(flat)) out.corpus[k.replace("/corpus/", "")] = v;
  return out;
}
```
> Confirm against the PRE-FLIGHT: whether `createStateStore` wants nested state (`{ corpus: {...} }`) or pointer-keyed — adjust `buildInitialState` accordingly so a fact component's `useStateValue("/corpus/careerTimeline")` lookup resolves.

- [ ] **Step 5: Mount the provider** from the **server** `app/layout.tsx`: import `corpusState` from `@/lib/corpus` (server-only) and wrap the page — `<JsonUiProvider initialState={corpusState()}>{children}</JsonUiProvider>`. Never import `@/lib/corpus` from `app/StoreProvider.tsx` or any other `"use client"` module — that pulls the `node:fs` loader into the client bundle and breaks the build.

- [ ] **Step 6: Run — expect PASS**, commit.

```bash
git add lib/jsonui/registry.tsx components/JsonUiProvider.tsx app/layout.tsx lib/jsonui/__tests__/registry.test.tsx
git commit -m "feat(jsonui): registry assembly + StateStore/Action/Visibility providers seeded with corpus"
```

---

### Task 8: `homeSpec` (current page, rebuilt from the catalog) + fidelity check

**Files:**
- Create: `noah-portfolio/lib/jsonui/homeSpec.ts`
- Test: `noah-portfolio/lib/jsonui/__tests__/homeSpec.test.ts`

**Interfaces:**
- Consumes: `validateSpec` from `@json-render/core`; the catalog component names.
- Produces: `homeSpec` (a valid spec object) composing About/Projects/Contact equivalents.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { validateSpec } from "@json-render/core";
import { homeSpec } from "@/lib/jsonui/homeSpec";
it("homeSpec is structurally valid", () => {
  expect(validateSpec(homeSpec as any).valid).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Author `homeSpec.ts`** — reproduce today's layout: an "About Me" `Section` (Prose bio + `Columns`(2) with `SkillGrid` (statePath `"/corpus/skills"`) and `CareerTimeline` (statePath `"/corpus/careerTimeline"`)), an OS grid, a "Projects" `Section` with `ProjectShowcase` (statePath `"/corpus/projects"`), and a "Contact Me" `Section` with `ContactCard` (statePath `"/corpus/contact"`). Set `statePath` to the literal pointer string (e.g. `props: { statePath: "/corpus/projects" }`) — the fact components resolve it internally via `useStateValue`; never wrap it in `{ "$state": ... }`.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Fidelity check (manual, documented):** run `npm run dev`, compare `homeSpec` render vs the current page side-by-side. For any visual gap the catalog can't express 1:1, register a one-off escape-hatch component (e.g. `OperatingSystems`) that lifts the exact JSX, add it to the catalog/registry, and reference it from `homeSpec`. Commit.

```bash
git add lib/jsonui/homeSpec.ts lib/jsonui/__tests__/homeSpec.test.ts
git commit -m "feat(jsonui): homeSpec reproducing the current page from the catalog"
```

---

### Task 9: OpenRouter client + prompt assembly

**Files:**
- Create: `noah-portfolio/lib/llm/openrouter.ts`, `lib/llm/prompt.ts`
- Test: `noah-portfolio/lib/llm/__tests__/prompt.test.ts`

**Interfaces:**
- Consumes: `createOpenRouter`, `catalog.prompt()`, `knowledge()`, `corpusSnapshot()`, `buildUserPrompt`, `getServerEnv()`.
- Produces: `getModel()` (AI SDK model), `buildSystemPrompt(): string`, `buildUserMessage(question: string): string`.

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/llm/prompt";
it("system prompt carries corpus rules + knowledge", () => {
  const p = buildSystemPrompt();
  expect(p).toContain("/corpus/");
  expect(p).toMatch(/off-topic/i);
  expect(p).toMatch(/Kuala Lumpur/);
});
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `openrouter.ts`**

```ts
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getServerEnv } from "@/lib/env";
export function getModel() {
  const env = getServerEnv();
  return createOpenRouter({ apiKey: env.openrouterApiKey })(env.openrouterModel);
}
```

- [ ] **Step 4: Implement `prompt.ts`**

```ts
import { buildUserPrompt } from "@json-render/core";
import { catalog } from "@/lib/jsonui/catalog";
import { knowledge, corpusSnapshot } from "@/lib/corpus";

const RULES = [
  "Compose ONLY from the catalog components.",
  "For factual data, set each fact component's statePath prop to the literal /corpus/* pointer string (e.g. \"/corpus/projects\") — never wrap it in a {\"$state\":...} binding and never write facts inline.",
  "Write narrative/connective text in Prose/Heading/Callout, first person as Noah.",
  "If the question is off-topic or hostile, return a brief Section that politely redirects and shows the about/projects/contact content.",
];
export function buildSystemPrompt(): string {
  return [catalog.prompt({ customRules: RULES }), "\n# Knowledge about Noah\n", knowledge()].join("\n");
}
export function buildUserMessage(question: string): string {
  return buildUserPrompt({ prompt: question, state: JSON.parse(corpusSnapshot()) });
}
```

- [ ] **Step 5: Run — expect PASS**, commit.

```bash
git add lib/llm lib/llm/__tests__/prompt.test.ts
git commit -m "feat(llm): OpenRouter model + grounded prompt assembly"
```

---

### Task 10: Cache (CF KV REST) + `/api/generate` route

**Files:**
- Create: `noah-portfolio/lib/cache/key.ts`, `lib/cache/kv.ts`, `app/api/generate/route.ts`
- Test: `noah-portfolio/lib/cache/__tests__/key.test.ts`, `app/api/__tests__/generate.test.ts`

**Interfaces:**
- Consumes: `getModel`, `buildSystemPrompt`, `buildUserMessage`, `getServerEnv`, `validateSpec`, `autoFixSpec`, `createJsonRenderTransform`, `CATALOG_VERSION`.
- Produces: `normalizeQuestion(q): string`, `cacheKey(q): string`, `kvGet(key)`, `kvPut(key, value)`, the route handler.

- [ ] **Step 1: Failing test — key normalization**

```ts
import { describe, it, expect } from "vitest";
import { normalizeQuestion, cacheKey } from "@/lib/cache/key";
it("normalizes case + whitespace", () => {
  expect(normalizeQuestion("  What  Does Noah DO? ")).toBe("what does noah do?");
});
it("namespaces by catalog version", () => {
  expect(cacheKey("x")).toMatch(/:v\d+$/);
});
```

- [ ] **Step 2: Run — expect FAIL; implement `key.ts`**

```ts
import { CATALOG_VERSION } from "@/lib/jsonui/catalogVersion";
export function normalizeQuestion(q: string): string { return q.trim().toLowerCase().replace(/\s+/g, " "); }
export function cacheKey(q: string): string { return `${normalizeQuestion(q)}:${CATALOG_VERSION}`; }
```

- [ ] **Step 3: Implement `kv.ts`** (no-op when CF creds absent)

```ts
import { getServerEnv } from "@/lib/env";
const base = (cf: { accountId: string; namespaceId: string }) =>
  `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/storage/kv/namespaces/${cf.namespaceId}/values`;
export async function kvGet(key: string): Promise<string | null> {
  const { cf } = getServerEnv(); if (!cf) return null;
  const r = await fetch(`${base(cf)}/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${cf.token}` } });
  return r.ok ? r.text() : null;
}
export async function kvPut(key: string, value: string): Promise<void> {
  const { cf } = getServerEnv(); if (!cf) return;
  await fetch(`${base(cf)}/${encodeURIComponent(key)}`, { method: "PUT", headers: { Authorization: `Bearer ${cf.token}` }, body: value });
}
```

- [ ] **Step 4: Failing route test** (mock `getModel`, `kvGet`/`kvPut`) — assert: (a) cache hit returns stored spec and does NOT call the model; (b) miss calls the model and writes the cache. Use `vi.mock`.

- [ ] **Step 5: Implement `app/api/generate/route.ts`**

```ts
import { NextRequest } from "next/server";
import { streamText } from "ai";
import { validateSpec, autoFixSpec } from "@json-render/core";
import { getModel } from "@/lib/llm/openrouter";
import { buildSystemPrompt, buildUserMessage } from "@/lib/llm/prompt";
import { cacheKey } from "@/lib/cache/key";
import { kvGet, kvPut } from "@/lib/cache/kv";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { question } = await req.json();
  if (typeof question !== "string" || question.length === 0 || question.length > 280)
    return new Response("bad request", { status: 400 });

  const key = cacheKey(question);
  const cached = await kvGet(key);
  if (cached) return new Response(cached, { headers: { "content-type": "application/json", "x-cache": "hit" } });

  // Stream the model's JSONL spec to the client; tee a copy to assemble + validate + cache.
  const result = await streamText({ model: getModel(), system: buildSystemPrompt(), prompt: buildUserMessage(question) });
  // Pipe result.textStream through createJsonRenderTransform / compiler; on finish, validateSpec -> autoFixSpec -> kvPut(key, JSON.stringify(finalSpec)).
  // (Wire per PRE-FLIGHT: exact useUIStream/transform handshake. The client consumes this stream via useUIStream.)
  return result.toTextStreamResponse({ headers: { "x-cache": "miss" } });
}
```
> The compile-and-cache-on-finish detail depends on the json-render stream handshake confirmed in PRE-FLIGHT. Keep the cache write strictly on the *miss* path, after `autoFixSpec`.

- [ ] **Step 6: Run — expect PASS**, commit.

```bash
git add lib/cache app/api/generate/route.ts lib/cache/__tests__ app/api/__tests__
git commit -m "feat(api): /api/generate with grounded streaming + CF KV cache (hit/miss)"
```

---

### Task 11: Client orchestration — hook, canvas, chat box

**Files:**
- Create: `noah-portfolio/lib/hooks/usePortfolioCanvas.ts`, `components/PortfolioCanvas.tsx`, `components/ChatBox.tsx`
- Test: `noah-portfolio/components/__tests__/portfolioCanvas.test.tsx`

**Interfaces:**
- Consumes: `useUIStream` + `createSpecStreamCompiler` (`@json-render/react`/`core`), `Renderer`, `registry`, `homeSpec`.
- Produces: `usePortfolioCanvas()` → `{ mode, spec, ask(q), reset() }`; `PortfolioCanvas`, `ChatBox` components.

- [ ] **Step 1: Failing test** — `PortfolioCanvas` shows the home content by default (e.g. "Supa" from `homeSpec`).

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `usePortfolioCanvas.ts`** — owns `mode: "home"|"streaming"|"answer"`, the active `spec` (default `homeSpec`), syncs `?q=` (read on mount → auto-`ask`; `ask` sets it, `reset` clears it). `ask(q)` POSTs to `/api/generate`, feeds the stream into `useUIStream`/`createSpecStreamCompiler`, sets `mode` accordingly; on error sets `spec = homeSpec`.

- [ ] **Step 4: Implement `PortfolioCanvas.tsx`** — `AnimatePresence` keyed on a spec identity; renders `<Renderer spec={spec} registry={registry} />`; a "↺ home" button calls `reset()` when `mode !== "home"`.

- [ ] **Step 5: Implement `ChatBox.tsx`** — controlled input (maxLength 280) + submit → `ask(value)`; lives in the hero.

- [ ] **Step 6: Run — expect PASS**, commit.

```bash
git add lib/hooks/usePortfolioCanvas.ts components/PortfolioCanvas.tsx components/ChatBox.tsx components/__tests__/portfolioCanvas.test.tsx
git commit -m "feat(ui): chat box + streaming canvas orchestration with home/answer transitions"
```

---

### Task 12: Wire the page + Hero; retire direct section usage

**Files:**
- Modify: `noah-portfolio/app/page.tsx`, `components/Hero.tsx`
- Test: `noah-portfolio/app/__tests__/page.test.tsx`

- [ ] **Step 1: Failing test** — `page.tsx` renders the chat box + the home canvas (assert chat input present + a home value like "Projects").
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** `components/Hero.tsx` — add `<ChatBox />` below the `SpotifyReveal` block (keep avatar + `TypeAnimation`).
- [ ] **Step 4:** `app/page.tsx` — replace `<About/><Projects/><Contact/>` with `<PortfolioCanvas/>`; keep `<LavaLampBackground/>` + `<Hero/>`. (The old section files remain only if still referenced by an escape-hatch component; otherwise delete them, since their JSX now lives in the registry.)
- [ ] **Step 5: Run — expect PASS**, commit.

```bash
git add app/page.tsx components/Hero.tsx app/__tests__/page.test.tsx
git commit -m "feat: hero chat + dynamic canvas as the page; retire static sections"
```

---

### Task 13: Error / off-topic resilience

**Files:**
- Modify: `lib/hooks/usePortfolioCanvas.ts` (fallback), `lib/llm/prompt.ts` (off-topic rule already present — verify), `components/PortfolioCanvas.tsx` (toast)
- Test: `components/__tests__/fallback.test.tsx`

- [ ] **Step 1: Failing test** — when `/api/generate` rejects (mock a 500), the canvas falls back to `homeSpec` and shows a non-blocking error message; never blank.
- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3:** Implement try/catch in `ask()` → on failure set `spec = homeSpec`, `mode = "home"`, surface a transient toast. Confirm `autoFixSpec` is applied to any assembled spec before render.
- [ ] **Step 4: Run — expect PASS**, commit.

```bash
git add lib/hooks/usePortfolioCanvas.ts components/PortfolioCanvas.tsx components/__tests__/fallback.test.tsx
git commit -m "feat(ui): graceful fallback to homeSpec on generation failure"
```

---

### Task 14: E2E (Playwright)

**Files:**
- Create: `noah-portfolio/playwright.config.ts`, `e2e/ask-me.spec.ts`

- [ ] **Step 1:** Playwright config (baseURL `http://localhost:3000`, `webServer: npm run dev`). Stub `/api/generate` with a fixture spec via `page.route` so E2E is deterministic (no live LLM).
- [ ] **Step 2: Write E2E:** (a) default page shows home content; (b) type a question → submit → canvas swaps to the fixture answer + `?q=` appears in the URL; (c) reload with `?q=` reproduces the answer; (d) "↺ home" restores the home content; (e) routed 500 → home content stays + error shown.
- [ ] **Step 3: Run** `npm run e2e` — expect PASS, commit.

```bash
git add playwright.config.ts e2e/ask-me.spec.ts
git commit -m "test(e2e): ask-me happy path, share, reset, and error fallback"
```

---

## Self-Review

**Spec coverage:** §1 dynamic recompose → T8/T10/T11; §3.1 one-system/adapt → T4–T8/T12; §3.2 corpus → T2; §3.3 OpenRouter/V4 Flash → T9/T10; §4 animation → T4–T6 motion + T11 AnimatePresence; §5 cache → T10; §6 guardrails → T1 (input cap)/T13; §7 share/reset → T11; §6 catalog → T3–T6; testing §13 → folded per-task + T14. Charting/Remotion/semantic cache are Phase 2 (out of this plan). All spec sections map to a task.

**Placeholder scan:** Component-adaptation steps reference exact source file:line and define the per-component data/binding — not "similar to". The two PRE-FLIGHT-gated spots (stream handshake in T10, `createStateStore` shape in T7) are flagged as verify-against-installed-types, not invented; this is the honest treatment of a fast-moving external API.

**Type consistency:** `statePath` prop used consistently across catalog (T3) and fact components (T5); `corpusState()` keys (`/corpus/*`) match `homeSpec` bindings (T8) and the registry test (T7); `normalizeQuestion`/`cacheKey` signatures consistent T10; `getModel`/`buildSystemPrompt`/`buildUserMessage` consistent T9→T10.

## Execution Handoff

(Offered to the user after issues are filed.)
