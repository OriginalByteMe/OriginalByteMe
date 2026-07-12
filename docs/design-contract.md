# Ask-Me Component Library Design Contract — v2

> **Version:** v2 (pastel / matte / dither). Supersedes v1 (frosted-glass-over-lava-lamp), which is retired — see §14.
>
> **Scope:** The shared visual language for every component in the json-render **Catalog**, and the motion language for **Story**/**Scene** compositions. Source of truth for component adaptation ([#29](https://github.com/OriginalByteMe/OriginalByteMe/issues/29)) and catalog expansion ([#30](https://github.com/OriginalByteMe/OriginalByteMe/issues/30)).
>
> **Branch:** `feat/ask-me-dynamic-portfolio`
>
> **Written against:** Tailwind CSS v4 (`tailwindcss@^4.3.2`), `framer-motion@^12`, `lucide-react@^0.469`, `@paper-design/shaders-react@0.0.77` (exact pin). The v1 Tailwind-v4 migration ([#25](https://github.com/OriginalByteMe/OriginalByteMe/issues/25)) has landed; all classes below are v4-safe arbitrary/utility values.
>
> **Prototypes (ground truth for this contract):**
> - Aesthetic: `noah-portfolio/app/aesthetic-prototype/_aesthetic-prototype.tsx` at `/aesthetic-prototype` — the winning candidates from [#35](https://github.com/OriginalByteMe/OriginalByteMe/issues/35). Every hex/class in §2–§8 is lifted from this file.
> - Scene/motion: `app/scene-prototype/page.tsx` + `lib/jsonui/components/_scene-prototype.tsx` at `/scene-prototype` — the resolved motion findings from [#37](https://github.com/OriginalByteMe/OriginalByteMe/issues/37), codified in §9.
>
> **Reference tickets:** #36 (this contract), #37 (scene findings → §9), #42 (Night Matte Bento as a future Backdrop **Preset**/**Theme** → §8.3, §10), #34 (Paper Shaders backdrop research → §10), #29/#30 (component adaptation to these tokens), #25 (Tailwind v4 — landed).
>
> **Prototype-only scaffolding — do NOT copy:** the aesthetic prototype's `CandidateChip` debug label and the intro `<header>` strip (`bg-[#f2f0eb] dark:bg-[#141317]`) are throwaway route chrome, not part of the language.

## 1. Overview — one base language, two registers

The design language is **Candidate A "Soft Field"**: an airy editorial pastel look with a `GrainGradient`-family **Backdrop**, serif display moments, dithered/halftone image treatment, matte (no-blur) surfaces, and lucide 1.5-stroke icons. It is the base everywhere, in **both** light and dark.

**Candidate C "Night Matte Bento"** is a **layout register**, not a dark mode. Its bento-grid composition, sphere-gradient accent, hex-halftone tiles, and violet/mint accents are sanctioned for **dense, stat-heavy moments** — the `StaticComposition` short-answer fallback, stat scenes, dashboard-ish chapters — in **both** color schemes (§8.3). Candidate C's *full* look (its exact backdrop + palette) is additionally preserved as a future Backdrop **Preset** / **Theme** (#42, §10).

| Register | When | Backdrop shape | Display type | Surface | Grid |
|----------|------|----------------|--------------|---------|------|
| **Base — Soft Field** | Everything by default; prose, hero, story scenes | `GrainGradient shape="wave"` | `font-serif` | matte card `rounded-3xl` (§3.1) | asymmetric cluster (§8.2) |
| **Density — Night Matte Bento** | Dense/stat/dashboard moments; short-answer `mode:"static"` fallback | `GrainGradient shape="sphere"` | sans `font-bold` | matte tile `rounded-2xl` (§3.2) | bento (§8.3) |

Both registers are matte in both schemes; neither uses `backdrop-blur`.

## 2. Color tokens

All values are arbitrary hex utilities (`text-[#...]`, `bg-[#...]`) lifted verbatim from the prototype. Never introduce a bright saturated accent (the v1 `blue-500` link color is retired, §14).

### 2.1 Base palette — Soft Field (light + dark)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Ink / primary | `text-[#37304a]` | `dark:text-[#eae6f2]` | Root text color on the base section, headings, strong body. |
| Body / muted | `text-[#5d5673]` | `dark:text-[#bdb6d0]` | Prose, lead paragraph, card list body. |
| Label / eyebrow | `text-[#6f6885]` | `dark:text-[#a9a2bd]` | Mono kickers, figcaptions, metadata. |
| Card surface | `bg-[#fffdf8]` | `dark:bg-[#2b2830]` | Matte cards (§3.1). |
| Tinted surface | `bg-[#f4ecdf]` | `dark:bg-[#26232c]` | Figure/image cards behind a dithered image. |
| Halftone track | `bg-[#efe6da]` | `dark:bg-[#2a2630]` | Container behind a `HalftoneDots` rule accent (§4.2). |
| Hairline border | `border-[#37304a]/10` | `dark:border-white/10` | Card borders, internal dividers. |
| Card shadow | `shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)]` | (same) | Soft matte lift; never a hard drop shadow. |
| Backdrop CSS fallback | `bg-gradient-to-br from-[#f2e7d9] via-[#e7dcf1] to-[#dcead9]` | `dark:from-[#252129] dark:via-[#2a2430] dark:to-[#232820]` | Painted under the shader for pre-hydration / WebGL-unavailable (§10). |

**Base Backdrop shader palette** (`GrainGradient`, §10):

| Field | Light | Dark |
|-------|-------|------|
| `colorBack` | `#f7f2e7` | `#222026` |
| `colors` | `['#dcc8f0','#f8d7c4','#cfe7d6','#f4e3c2']` | `['#5e5175','#75564e','#4d6154','#6e6550']` |

### 2.2 Accent handling

The accent is a **violet ink**, not a bright link color. Two grounded steps plus one register-only secondary:

| Accent token | Light | Dark | Source / usage |
|--------------|-------|------|----------------|
| Violet ink (texture) | `#7a5fa0` | `#c9b3ec` | `colorFront` of the Soft Field dither/halftone (§4). The base register's ambient accent. |
| Violet emphasis | `text-[#5646a8]` | `dark:text-[#9d8ff2]` | Emphasis spans, links, interactive accents; C's display accent span. |
| Mint secondary | `text-[#5646a8]` | `dark:text-[#7fe0bd]` | **Density register only** — dark-scheme "newly/live" highlight (light collapses to violet emphasis). |

Rules:
- Links / interactive text use **violet emphasis**; hover deepens via `underline`/opacity, never a new hue.
- Specs never choose free-form accent hex. A **Scene**'s optional `accent` (§9.4) selects from this allowlist; anything richer is a **Preset**/**Theme** concern (#42).
- `italic`/`<em>` (no color) is the base register's lightest emphasis (§6.1).

### 2.3 Density register palette — Night Matte Bento (light + dark)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Ink / primary | `text-[#2e2b38]` | `dark:text-[#e9e6f2]` | Root text on a bento section. |
| Tile secondary | `text-[#5a5470]` | `dark:text-[#b3acce]` | Tile body / captions. |
| Tile label | `text-[#6b6580]` | `dark:text-[#a29bbd]` | Mono `[10px]` tile labels. |
| Tile surface | `bg-[#f6f4f9]` | `dark:bg-[#211f29]` | Matte tile (§3.2). |
| Tile border | `border-[#2e2b38]/10` | `dark:border-white/10` | Tile hairline. |
| Tile shadow | `shadow-[0_10px_30px_-18px_rgba(20,19,25,0.5)]` | (same) | Tighter, denser lift than base. |
| Display accent | `text-[#5646a8]` | `dark:text-[#9d8ff2]` | The accent span inside the dense display heading. |
| Backdrop CSS fallback | `bg-gradient-to-b from-[#dfe3ee] via-[#e6dcea] to-[#dce7e2]` | `dark:from-[#17161d] dark:via-[#1b1723] dark:to-[#141a18]` | Under the sphere shader. |

**Density Backdrop shader palette** (`GrainGradient shape="sphere"`):

| Field | Light | Dark |
|-------|-------|------|
| `colorBack` | `#e9e7ef` | `#141319` |
| `colors` | `['#bcc9e6','#cdb7e0','#eec6d5','#bfe2d8']` | `['#9d8ff2','#6ea3e8','#ef9cc2','#7fe0bd']` |

## 3. Matte surfaces & framing

Matte = solid opaque fills, hairline borders, soft long-throw shadows. **No `backdrop-blur`, no translucency, no `FrostedGlassBox`** (§14).

### 3.1 Matte card — base register

The canonical raised surface (Soft Field cards):

```tsx
<div className="rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] p-8 shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] dark:border-white/10 dark:bg-[#2b2830]">
```

- A **figure** card that hosts a dithered image swaps the fill to the tinted surface: `bg-[#f4ecdf] dark:bg-[#26232c]` and clips with `overflow-hidden` (§4.1).
- Cards may take small vertical offsets for editorial asymmetry (`md:translate-y-10`, `md:-translate-y-6`) — see §8.2.

### 3.2 Matte tile — density register

The bento tile (single shared class string in the prototype, reuse it):

```tsx
<div className="rounded-2xl border border-[#2e2b38]/10 bg-[#f6f4f9] p-6 shadow-[0_10px_30px_-18px_rgba(20,19,25,0.5)] dark:border-white/10 dark:bg-[#211f29]">
```

Tiles are tighter (`p-6`, `rounded-2xl`) than base cards (`p-8`, `rounded-3xl`).

### 3.3 Dividers & internal borders

Internal separators reuse the hairline border: base `border-b border-[#37304a]/10 dark:border-white/10`; density uses the `#2e2b38/10` border. No `<hr>`, no shadow dividers.

### 3.4 Frosted glass is retired

`FrostedGlassBox` is **not** a surface in this contract. It appears only in the migration note (§14). Any component still rendering it is a #29 adaptation target.

## 4. Texture — dither & halftone

Texture is decorative, always `aria-hidden`, always static (`speed={0}`) except the animated Backdrop, and always `minPixelRatio={1}`. Two paper-shaders primitives carry it. The full-screen surface fills use:

```tsx
const SHADER_FILL = { position: 'absolute', inset: 0, width: '100%', height: '100%' } as const;
```

### 4.1 Dithered images — `ImageDithering`

An 8×8 ordered dither is the sanctioned photo/portrait treatment (replaces raw `object-cover` photos). Inside a tinted figure card (§3.1) sized e.g. `h-56 w-full`:

```tsx
<ImageDithering
  image="/hero.png"
  colorFront={portrait.colorFront}   // #7a5fa0 light · #c9b3ec dark
  colorBack={portrait.colorBack}     // #f4ecdf light · #26232c dark
  colorHighlight={portrait.colorHighlight} // #f3d9c8 light · #8d7bb0 dark
  type="8x8" size={2} colorSteps={3} speed={0} minPixelRatio={1}
  style={{ width: '100%', height: '100%' }}
/>
```

| `SOFT_FIELD_PORTRAIT` | Light | Dark |
|-----------------------|-------|------|
| `colorFront` | `#7a5fa0` | `#c9b3ec` |
| `colorBack` | `#f4ecdf` | `#26232c` |
| `colorHighlight` | `#f3d9c8` | `#8d7bb0` |

Pair with a `font-mono text-[10px] uppercase tracking-widest` figcaption naming the treatment (e.g. `hero.png · 8×8 ordered dither`).

### 4.2 Halftone shapes — `HalftoneDots`

Two sanctioned uses:

**(a) Rule accent (base).** A short horizontal band separating hero blocks, in a track surface (§2.1):

```tsx
<div aria-hidden className="relative mt-14 h-12 w-full max-w-3xl overflow-hidden rounded-full bg-[#efe6da] dark:bg-[#2a2630]">
  <HalftoneDots image="/hero.png" colorFront={rule.colorFront} colorBack={rule.colorBack}
    type="classic" grid="square" size={1} radius={1.3} contrast={0.5} speed={0} minPixelRatio={1} style={SHADER_FILL} />
</div>
```

`SOFT_FIELD_RULE`: `colorFront` `#7a5fa0`/`#c9b3ec`, `colorBack` `#f7f2e7`/`#222026`.

**(b) Bento accent tile (density).** A `col-span-1 row-span-2` figure tile with a **hex** grid:

```tsx
<HalftoneDots image="/hero.png" colorFront={tile.colorFront} colorBack={tile.colorBack}
  type="classic" grid="hex" size={0.8} radius={1.35} contrast={0.55} speed={0} minPixelRatio={1} style={SHADER_FILL} />
```

`NIGHT_TILE`: `colorFront` `#5646a8`/`#7fe0bd`, `colorBack` `#f6f4f9`/`#211f29`.

### 4.3 Texture rules

- Decorative only — texture never carries semantic content; wrap in `aria-hidden`.
- `speed={0}` and `minPixelRatio={1}` on every non-Backdrop shader.
- Palettes are **module-level constants** (stable array identities) so a theme swap changes one reference — no per-render uniform churn.
- `grid="hex"` and blob/sphere shapes are the mobile-costly variants (§10); keep them small (accent tiles), never full-screen.

## 5. Icon language

One treatment everywhere: **lucide-react at 1.5 stroke width.**

```tsx
const ICON = { strokeWidth: 1.5 } as const;
// <Code2 {...ICON} className="size-4" />
```

| Context | Class | Notes |
|---------|-------|-------|
| Inline / label / trailing icon | `size-4` | Default. Mono labels, tile headers. |
| List-leading icon | `mt-0.5 size-4 shrink-0` | Aligns to first text line; never shrinks. |
| Trailing affordance | `size-4 shrink-0` | e.g. `ArrowUpRight` on link rows. |

- Always spread `{...ICON}` — never a bare lucide icon (default stroke is 2).
- Prefer minimal outline glyphs already in the prototype set: `ArrowUpRight, Code2, GitBranch, Sparkles, Mail, Terminal, Layers, Globe`. Add new lucide glyphs at 1.5 stroke only.
- No filled icons, no icon fonts (`react-icons` is legacy — migrate under #29).

## 6. Typography

The app loads **Inter** (sans) via `next/font`. `font-serif` / `font-mono` currently resolve to Tailwind's default system stacks; wiring a dedicated display serif + mono via `next/font` is **deferred** (§15).

### 6.1 Serif display scale (base register story moments)

Serif is reserved for display moments — hero, `ChapterHeading`, card titles. Use `tracking-tight`.

| Role | Classes |
|------|---------|
| Hero display | `font-serif text-[clamp(3.5rem,9vw,8rem)] leading-[0.92] tracking-tight` (emphasis via `<em className="italic">`) |
| Chapter display (`ChapterHeading`) | `font-serif text-4xl md:text-6xl tracking-tight` (spring stiffness 220 / damping 24, §9.2) |
| Card / section heading | `font-serif text-2xl tracking-tight` |

### 6.2 Dense display (density register)

Candidate C's display is **sans `font-bold`**, not serif, and overlaps the grid edge with negative margin. The accent word takes violet emphasis (§2.3):

```tsx
<h2 className="relative z-20 -mb-7 text-[clamp(3.5rem,8.5vw,8rem)] font-bold leading-[0.9] tracking-tight md:-mb-12">
  After hours,<br /><span className="text-[#5646a8] dark:text-[#9d8ff2]">still shipping.</span>
</h2>
```

### 6.3 Text scale (both registers)

| Role | Classes |
|------|---------|
| Eyebrow / kicker | `font-mono text-xs uppercase tracking-[0.3em]` |
| Tile label (density) | `font-mono text-[10px] uppercase tracking-[0.25em]` |
| Lead paragraph | `text-lg leading-relaxed` (`max-w-md` hero / `max-w-2xl` narrative) |
| Narrative beat (`NarrativeBeat`) | `text-lg` in `max-w-2xl` |
| Tile heading | `text-xl font-semibold tracking-tight` (or `text-base` for 1×1 tiles) |
| Body / card list | `text-sm leading-relaxed` |
| Secondary tile body | `text-sm` in tile-secondary ink (§2.3) |
| Metadata footer | `text-xs uppercase tracking-widest` |
| Caption / figcaption | `font-mono text-[10px] uppercase tracking-widest` |

## 7. Spacing & radius tokens

Updated from v1 where the prototype differs.

### 7.1 Spacing

| Name | Value | Usage |
|------|-------|-------|
| `space-xs` | `gap-2` / `gap-3` | Icon + text pairs (`gap-3` for list-leading icons). |
| `space-sm` | `space-y-4` | Card internals, list rhythm. |
| `space-bento` | `gap-3` | Bento tile gaps (density §8.3). |
| `space-cluster` | `gap-6` | Base card cluster gaps (§8.2). |
| `card-pad-base` | `p-8` | Matte card padding (base). |
| `card-pad-tile` | `p-6` | Matte tile padding (density). |
| `container-x` | `px-6 md:px-10` | Page horizontal padding (was `px-4`). |
| `container-y` | `pb-24 pt-32` | Page vertical rhythm (hero); scenes use `min-h-screen`, §9.2. |

### 7.2 Border radius

| Name | Class | Usage |
|------|-------|-------|
| `radius-pill` | `rounded-full` | Halftone rule track, pills, tags. |
| `radius-card` | `rounded-3xl` | Base matte cards & figures (§3.1). |
| `radius-tile` | `rounded-2xl` | Density tiles & C figures (§3.2). |

## 8. Layout & grids

### 8.1 Page container & backdrop

```tsx
<section className="relative min-h-screen overflow-hidden text-[#37304a] dark:text-[#eae6f2]">
  <div aria-hidden className="absolute inset-0 z-0 bg-gradient-to-br from-[#f2e7d9] ... dark:...">
    <GrainGradient style={SHADER_FILL} ... />   {/* §10 */}
  </div>
  <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32 md:px-10">
    {/* content */}
  </div>
</section>
```

`overflow-hidden` clips the full-bleed backdrop; `z-0` backdrop, `z-10` content. Content column is `max-w-6xl`.

### 8.2 Base grids — asymmetric cluster

The base register composes cards in an editorial 12-col cluster with intentional vertical offsets, **not** a uniform grid:

```tsx
<div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-12">
  <div className="... md:col-span-5">…</div>
  <div className="... md:col-span-4 md:translate-y-10">…</div>
  <figure className="... md:col-span-3 md:-translate-y-6">…</figure>
</div>
```

`<Columns>`/`<Grid>` primitives keep literal responsive class maps (never template strings — Tailwind must see full names) as in v1 §2.4.

### 8.3 Density register — the bento layout

**When it applies (both light and dark):**
- The `StaticComposition` short-answer fallback (`StorySpec mode:"static"`, §9.5).
- Stat-heavy scenes (multiple `StatReveal`), dashboard-ish chapters, dense multi-fact answers.
- Any moment where several small facts must coexist above the fold.

**Rules:**
- Grid: `grid auto-rows-[minmax(7rem,auto)] grid-cols-2 gap-3 md:grid-cols-4`.
- Tile spans express hierarchy: hero fact `col-span-2 row-span-2`; column facts `col-span-1 row-span-2`; wide feature `col-span-2`; atom facts `col-span-1`.
- Tiles are matte tiles (§3.2); labels are mono `[10px]` with a `size-4` icon (§5).
- Display heading is sans-bold and overlaps the grid top edge via negative margin (§6.2).
- Backdrop is the sphere `GrainGradient` (§2.3, §10); accents are violet emphasis + (dark) mint.
- Applies in **both** schemes — it is a composition register, not a dark theme.

Candidate C's *complete* look (its full palette + backdrop as a bundled identity) is preserved as a future Backdrop **Preset**/**Theme** in #42; that is distinct from using the bento *layout* here.

### 8.4 Reading / static column

Short answers and the static story fallback render in a centered reading column: `mx-auto w-full max-w-3xl`. Generated specs in this column do **not** add their own full-width section wrappers (see §12).

## 9. Motion

### 9.1 Baseline — shared `enter` (kept from v1)

The one mount animation for every Catalog component, in `lib/jsonui/motion.ts`:

```ts
export const enter: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, type: "spring", stiffness: 220, damping: 24 },
  }),
};
```

- Wrap component roots in `motion.*` with `variants={enter} initial="hidden" animate="show"`.
- Lists pass `custom={index}` to stagger by 60 ms.
- Do not invent spring values; extend `motion.ts` and document here.

### 9.2 Scene motion (scroll-driven, from #37)

A **Scene** is a full-height (`min-h-screen`) chapter driven by scroll entry:

```tsx
<motion.section
  initial="hidden"
  whileInView="show"
  viewport={{ once: true, amount: 0.3 }}
  variants={{ show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } } }}
>
```

- **Scene:** `viewport={{ once: true, amount: 0.3 }}` — reveal once, when 30% enters. Parent `staggerChildren: 0.12`, `delayChildren: 0.1` drives an in-scene stagger of its blocks (children reuse `enter`).
- **`ChapterHeading`:** kicker (e.g. `Chapter 02`) + serif display (§6.1) `text-4xl md:text-6xl`; spring stiffness 220 / damping 24 (same as `enter`).
- **`NarrativeBeat`:** one prose paragraph, `max-w-2xl text-lg`.
- **`StatReveal`:** count-up metric gated on `useInView` with **tighter `amount: 0.6`** (so it doesn't count while barely visible); `useMotionValue` + `animate` + `useTransform`.
- **`SequencedTimeline`:** rows reveal via nested `staggerChildren`; provide exactly one row source: inline `rows` or a `statePath` bound to Corpus state.
- **`SceneProgress`:** the **only** scrub-driven element — `useScroll` → `useSpring` → `scaleY` rail.

**Granularity rule:** cap a scene at **2–3 blocks** — one `ChapterHeading` anchor + one payload block (beat / stat / timeline). At 4+ blocks the 0.12s stagger pushes the tail reveal past ~0.6s after entry, animating after the reader has scrolled away; 1 block wastes a viewport. Promote heavy elements (timeline, multi-stat) to their own scene.

### 9.3 Trigger vs scrub

| Mode | Driver | Cost | Use for |
|------|--------|------|---------|
| **Trigger** | `whileInView`, one-shot, own timeline | cheap, intentional | All chapter reveals and in-scene stagger. |
| **Scrub** | `useScroll`, continuous, every frame, bidirectional | expensive | Progress rails, parallax, pinned sequences only. |

Default to trigger. Reach for scrub only for `SceneProgress`-type continuous rails.

### 9.4 StorySpec shape (JSON-render-friendly; array order IS scene order)

```ts
type StoryBlock =
  | { type: "chapterHeading"; props: { kicker?: string; text: string } }
  | { type: "narrativeBeat";  props: { text: string } }
  | { type: "statReveal";     props: { value: number; suffix?: string; caption: string } }
  | { type: "timeline";       props: { rows: { period: string; role: string; company: string }[] } };

type StorySpec = {
  mode: "scenes" | "static";
  scenes: { id: string; accent?: string; align?: "center" | "start"; blocks: StoryBlock[] }[];
};
```

A Scene's optional `accent` selects from the §2.2 allowlist only. `align` maps `center`/`start` to layout alignment.

### 9.5 Static fallback (short answers)

The **same block set** drives scenes and the static fallback by swapping only the motion driver. `StaticComposition` renders the blocks in a centered `max-w-3xl` column (§8.4) with plain mount stagger (shared `enter`, §9.1) — no scroll dependency. Short answers reuse the identical spec with `mode: "static"`; dense static answers use the bento register (§8.3).

### 9.6 Reduced motion

`prefers-reduced-motion` forces every shader `speed` to `0` (Backdrop and texture) and should render a curated still `frame` for the Backdrop (§10). Component `enter`/scene stagger degrade to instant per framer-motion's reduced-motion handling. The prototype's `usePrefersReducedMotion()` is the reference; the app-wide seam lives in the Backdrop component (§10).

## 10. Backdrop preset guidance

The **Backdrop** is a single full-screen `@paper-design/shaders-react` canvas (pinned `0.0.77`), steered per answer. Constraints below trace to the #34 research doc.

- **Family:** the `GrainGradient` shaders are the sanctioned Backdrop for both registers — base uses `shape="wave"`, density uses `shape="sphere"`. Prototyped props:

  | Register | shape | softness | intensity | noise | speed (active) |
  |----------|-------|----------|-----------|-------|----------------|
  | Base (Soft Field) | `wave` | `0.85` | `0.4` | `0.3` | `0.35` |
  | Density (Night Matte) | `sphere` | `0.7` | `0.5` | `0.3` | `0.45` |

- **Presets only, never free-form params.** A spec selects an allowlisted **Preset** (shader + palette + speed); it never sets raw shader uniforms. The palettes in §2.1 / §2.3 are the two seed presets; the full Preset **Catalog** (and Night Matte Bento as a bundled Preset/Theme) is owned by #42.
- **Pre-hydration / fallback:** always paint the CSS gradient (§2.1, §2.3) under the shader — it is both the pre-JS first paint and the WebGL-unavailable fallback. Wrap the canvas in an error boundary that falls back to that gradient (library throws if WebGL2 is missing; no built-in fallback).
- **Reduced motion:** `speed={0}` cancels the rAF loop; pass a curated static `frame` for a branded still (§9.6).
- **Mobile cost levers:** `minPixelRatio={1}` (prototype default) and cap `maxPixelCount` (~1.6M) on coarse pointers — gradients survive downscaling. `GrainGradient` blob/sphere is ~5× the wave cost; keep costly full-screen work off mobile where possible.
- **Steering vs switching:** same-shader palette/speed changes are cheap uniform writes (tween app-side, keep color-array length constant). Switching shader *type* is a canvas remount — cross-fade by briefly stacking two canvases, never keep two past the fade.
- **Pin exactly** `0.0.77`; upgrades are deliberate (breaking changes ship under 0.0.x).

## 11. Component boundaries

Carried forward from v1 §4, re-skinned to §2–§8. Components adopt tokens under #29; the shared `useIsDark()` helper (`lib/jsonui/use-is-dark.ts`) still owns dark detection — no per-component `MutationObserver`.

### 11.1 Primitives (`lib/jsonui/components/primitives.tsx`)

| Component | Contract |
|-----------|----------|
| `<Section>` | Full-width chapter: base container (§8.1), optional serif title (§6.1), `motion.section` with `enter`. `height="screen"` → `min-h-screen`; `centered` adds `flex flex-col items-center justify-center`. |
| `<Stack>` | Vertical rhythm (`space-y-*` per `gap`), `motion.div` with `enter`. |
| `<Columns>` / `<Grid>` | Literal responsive class maps (never template strings). Base cluster uses the §8.2 12-col pattern; dense uses the §8.3 bento. |
| `<Prose>` | Body/muted ink (§2.1), `max-w-2xl`, `motion.p` with `enter`; optional `statePath` binds to Corpus state. |
| `<Heading>` | Serif subsection heading `font-serif text-2xl tracking-tight` (§6.1), level clamped 1–4. |
| `<Callout>` | Matte card (§3.1) with `border-l-4` in an accent from §2.2; `motion.div` with `enter`. |
| `<Quote>` | `border-l-2` hairline + `pl-4 italic`, optional cite. |

### 11.2 Facts (`lib/jsonui/components/facts.tsx`)

| Component | Contract |
|-----------|----------|
| `<ProjectShowcase>` | Matte figure cards (§3.1) with **dithered** cover images (§4.1); `rounded-3xl overflow-hidden`; staggered `enter`. |
| `<SkillGrid>` / `<SkillCloud>` | Pills on matte surfaces (§3), mono labels; category headings via serif `<Heading>` + `Code2` icon (§5). |
| `<CareerTimeline>` | Left-border timeline; `motion.li` staggered `enter`; `Briefcase`/`Layers`-style icon at 1.5 stroke; company links use violet emphasis (§2.2). Promote to `SequencedTimeline` (§9.2) inside stories. |
| `<ContactCard>` | Grid of matte cards (§3.1), large 1.5-stroke icon + title + link. |
| `<StatCallout>` | Big serif/number value + caption on a matte surface; inside a story use `StatReveal` (§9.2). |
| `<OperatingSystemsGrid>` | Matte-card grid; header icon `size-4` (was `w-8 h-8`) beside env name; staggered `enter`. |

### 11.3 Story primitives (`#37` → promote into Catalog)

`Scene`, `ChapterHeading`, `NarrativeBeat`, `StatReveal`, `SequencedTimeline`, `SceneProgress`, `StaticComposition` (§9). `SequencedTimeline` accepts exactly one of inline `rows` or a Corpus `statePath`; the two sources are mutually exclusive. Promotion of the scene-prototype primitives into the shipping Catalog is tracked under #37.

### 11.4 Personality (`lib/jsonui/components/extras.tsx`)

| Component | Contract |
|-----------|----------|
| `<LottieFigure>` | Centered `w-full max-w-sm`, optional caption. |
| `<SpotifyNowPlaying>` | Reuses `<SpotifyReveal />`; keep styling untouched (audit under #29 for matte alignment). |
| `<ImageBlock>` | Dithered image (§4.1) in a matte figure (`rounded-3xl`), optional mono figcaption. |
| `<StepFlow>` | `motion.ol` staggered `motion.li`; numbered badge on a matte/accent surface (no `bg-blue-500` — use violet emphasis, §2.2). |
| `<SideProjects>` | Static matte-card grid (escape hatch); promote to data-driven `FeatureCard` if answers need this shape. |

## 12. Home vs story / answer layouts

### 12.1 Home layout
- Rendered by `homeSpec.ts`; full-width `<Section>` stack in the base register.
- Uses fact components (`SkillGrid`, `CareerTimeline`, `ProjectShowcase`, `ContactCard`); each section owns its container (§8.1).

### 12.2 Story / answer layout
- Generated by `/api/generate` as a `StorySpec` (§9.4).
- `mode: "scenes"` → full-height Scenes (§9.2), scroll-choreographed, base register (dense chapters may use the bento register, §8.3).
- `mode: "static"` (short answers) → centered `max-w-3xl` reading column (§8.4) with `enter` stagger; dense static answers use the bento register.
- Generated specs in the static column do **not** wrap content in `<Section>` (it adds full-width container + `min-h-screen`). Use `<Stack>` / `<Heading>` / `<Prose>` / `<Callout>` / `<StatReveal>` instead.

## 13. Prompt guidance for `/api/generate`

Append to the Catalog prompt:

1. Compose answers as a **Story** (`StorySpec`): `mode:"scenes"` for narrative multi-part answers, `mode:"static"` for short answers — the same blocks drive both.
2. Cap each **Scene** at 2–3 blocks: one `chapterHeading` + one payload (`narrativeBeat` / `statReveal` / `timeline`). Promote heavy elements to their own scene.
3. Use the **base (Soft Field)** register by default; switch to the **bento density** register (§8.3) only for stat-heavy or multi-fact-dense moments (both apply in light and dark).
4. Surfaces are **matte** — never request blur, glass, or translucency. Use serif for display/chapter headings, mono for kickers/labels.
5. Accents come from the fixed violet palette (§2.2); do not request colors. A Scene may set `accent` from the allowlist only.
6. Backdrop is chosen by **Preset** (§10), never raw shader params.
7. Keep motion implicit — components animate via `enter`; scenes via `whileInView`. Do not add custom `motion` props.
8. Generated prose is concise (1–2 short paragraphs per beat) and lives in `max-w-2xl` (scene) / `max-w-3xl` (static).

## 14. Migration from v1 (retired)

| v1 (retired) | v2 replacement |
|--------------|----------------|
| **Lava-lamp navy-blob background** | Single `GrainGradient` **Backdrop** (§10), Preset-selected, with CSS-gradient fallback (§2.1). |
| **`FrostedGlassBox`** (translucent frosted surface, `variant`/`glassOpacity`/`hoverEffect`) | **Matte** surfaces (§3): `rounded-3xl`/`rounded-2xl` opaque cards/tiles, hairline borders, soft shadows. `FrostedGlassBox` is retired — remove it from Catalog components (#29). No `backdrop-blur` anywhere. |
| `blue`/`emerald`/`purple`/`amber`/`rose` frosted variants; `text-blue-500` links | Fixed **violet ink** accent (§2.2); mint secondary in the density register (dark). No bright saturated hues. |
| Solid `bg-gray-100/900` media cards with raw `object-cover` photos | Tinted matte figure cards with **dithered** images (§4.1). |
| `text-3xl font-bold` sans headings only | Serif display scale (§6.1) + dense sans display (§6.2); mono kickers/labels (§6.3). |
| `rounded-xl` card / `container px-4` / `py-20` | `rounded-3xl`/`rounded-2xl` (§7.2); `max-w-6xl px-6 md:px-10`, `pb-24 pt-32` (§7.1). |
| `bg-blue-500` step badges, per-component `MutationObserver` | Violet-emphasis badges (§2.2); shared `useIsDark()` (§11). |
| Flat answer render in `max-w-3xl` | Story/Scene motion model (§9) with a `max-w-3xl` static fallback. |

## 15. Deferred / open items

- **Display serif + mono fonts:** app loads only Inter; `font-serif`/`font-mono` fall back to system stacks. Wire a dedicated display serif and mono via `next/font` — needs a font-wiring ticket (not yet filed).
- **Backdrop Preset Catalog:** the full allowlist of Presets (beyond the two seed palettes in §2.1/§2.3) and **Night Matte Bento as a bundled Preset/Theme** — owned by **#42**; shader constraints in **#34**.
- **Story primitive promotion:** move `Scene`/`ChapterHeading`/`StatReveal`/etc. from the #37 prototype into the shipping Catalog — **#37**.
- **Component adaptation to these tokens:** re-skin existing Catalog components off `FrostedGlassBox`/`blue` onto §2–§8 — **#29**; new primitives (shadcn) — **#30**.
- **`react-icons` → lucide migration:** any remaining `react-icons` usages should move to lucide at 1.5 stroke (§5) — under **#29**.
