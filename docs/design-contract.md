# Ask-Me Component Library Design Contract

> **Scope:** This contract defines the shared visual language for every component in the json-render catalog. It is the source of truth for [#29 Adapt components to match original fidelity](https://github.com/OriginalByteMe/OriginalByteMe/issues/29) and [#30 Expand catalog with shadcn primitives](https://github.com/OriginalByteMe/OriginalByteMe/issues/30).
>
> **Branch:** `feat/ask-me-dynamic-portfolio`  
> **Written against:** Tailwind CSS v3.4 + shadcn/ui baseline (to be migrated to v4 in #25; contract uses stable utility classes that survive the migration).  
> **Prototype:** See `noah-portfolio/lib/jsonui/components/_prototype.tsx` and the runnable page at `/design-contract`.

## 1. Tokens

### 1.1 Color

The portfolio background is a full-screen animated lava-lamp (navy blobs). Components sit **above** that background, so every surface must be translucent or low-contrast enough to let the blobs read through.

| Token | Light mode | Dark mode | Usage |
|-------|------------|-----------|-------|
| Page background | `bg-white` / `body` | `body.dark bg-black` | Never used inside a catalog component; the lava-lamp is the backdrop. |
| Primary text | `text-gray-900` | `dark:text-white` | Headings, strong body text. |
| Secondary text | `text-gray-700` | `dark:text-gray-300` | Body paragraphs, descriptions. |
| Tertiary text | `text-gray-500` | `dark:text-gray-400` | Captions, dates, metadata. |
| Muted text | `text-gray-400` | `dark:text-gray-500` | Disabled/placeholder hints. |
| Accent / links | `text-blue-500 hover:text-blue-600` | `dark:text-blue-400 dark:hover:text-blue-300` | External links, inline CTAs. |
| Card surface (solid) | `bg-gray-100` | `dark:bg-gray-900` | Media cards that need opaque backing for images. |
| Pill surface (solid) | `bg-gray-200` | `dark:bg-gray-800` | Technology / metadata pills on solid cards. |

**Frosted-glass palette** (via `<FrostedGlassBox variant="...">`):

| Variant | Role |
|---------|------|
| `blue` | **Default.** Info cards, contact cards, skill pills, callouts. Matches the navy blob theme. |
| `emerald` | Success states, Spotify accents, positive callouts. |
| `purple` | Personality blocks, Lottie figures, creative flourishes. |
| `amber` / `gold` | Warnings, highlights, achievements. |
| `rose` | Errors, destructive actions. |
| `gray` | Neutral dividers, low-emphasis containers. |

### 1.2 Spacing

Use the Tailwind default scale. The following sizes are the **canonical** ones for generated layouts:

| Name | Value | Usage |
|------|-------|-------|
| `space-xs` | `gap-2` / `space-y-2` | Inline pill lists, icon + text pairs. |
| `space-sm` | `gap-4` / `space-y-4` | Card internals, list items, timeline rows. |
| `space-md` | `gap-6` / `space-y-6` | Grid gaps (OS cards, side projects), card padding, subsection stacks. |
| `space-lg` | `gap-8` / `space-y-8` | Major grids (projects 2–3 col, contact 3 col). |
| `space-xl` | `gap-12` / `space-y-12` | Two-column splits (About skills vs. work history). |
| `section-y` | `py-20` | Vertical breathing room for every `<Section>`. |
| `container-x` | `px-4` | Horizontal page padding. |

### 1.3 Border radius

| Name | Class | Usage |
|------|-------|-------|
| `radius-pill` | `rounded-full` | Skill pills, tech pills, tags. |
| `radius-card` | `rounded-xl` | Frosted-glass cards, callouts, stat callouts. |
| `radius-media` | `rounded-2xl` | Project/media cards, image blocks, Lottie containers. |

### 1.4 Typography

All text uses the Next.js / Tailwind default sans stack (Geist where loaded).

| Element | Classes | Notes |
|---------|---------|-------|
| Page / answer heading | `text-3xl font-bold` | `h1` or `h2` depending on nesting. |
| Section heading | `text-3xl font-bold mb-8` | Rendered by `<Section title="...">`. |
| Subsection heading | `text-2xl font-semibold mb-4 flex items-center` | Used inside fact components (Skills, Work History, etc.). |
| Category label | `text-lg font-medium mb-2 text-gray-700 dark:text-gray-300 flex items-center` | Skill categories, list group labels. |
| Card title | `text-xl font-semibold mb-2` | Contact cards, project cards. |
| Body | `text-gray-700 dark:text-gray-300` | Prose, descriptions. Max line length `max-w-2xl` for readability. |
| Caption | `text-sm text-gray-500 dark:text-gray-400` | Figcaptions, dates, metadata. |
| Big number | `text-4xl font-bold` | `<StatCallout>` value. |

## 2. Surfaces & framing

### 2.1 Frosted glass is the default elevated surface

Use `<FrostedGlassBox>` for anything that should feel like a physical card floating above the lava-lamp:

- Information cards (contact, operating systems, side projects)
- Skill / tech pills
- Callouts and stat callouts
- Step-flow items (optional)

**Default props for a raised card:**

```tsx
<FrostedGlassBox
  variant="blue"
  hoverEffect="lift"
  glassOpacity="heavy"
  className="p-6 rounded-xl"
>
```

**Default props for a pill:**

```tsx
<FrostedGlassBox
  className="px-3 py-1 rounded-full text-sm flex items-center gap-2 w-max m-0"
  variant="blue"
  hoverEffect="lift"
  glassOpacity="light"
>
```

### 2.2 Solid cards for media-heavy content

Project cards and image blocks use an opaque backing so photographs/screenshots keep consistent contrast:

```tsx
<a className="group bg-gray-100 dark:bg-gray-900 rounded-2xl overflow-hidden transition-all hover:scale-105 hover:shadow-lg">
```

Pills inside solid cards use the solid palette:

```tsx
<div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1 rounded-full text-sm">
```

### 2.3 Layout containers

Every full-width section follows this exact wrapper:

```tsx
<section className="relative py-20">
  <div className="container mx-auto px-4">
    {/* content */}
  </div>
</section>
```

The `relative` keeps the section above the background layer; `container mx-auto px-4` provides consistent horizontal bounds.

### 2.4 Grids

| Layout | Class |
|--------|-------|
| 2-col feature split | `grid md:grid-cols-2 gap-12` |
| 3-col contact grid | `grid md:grid-cols-3 gap-8` |
| 2–3 col project grid | `grid md:grid-cols-2 lg:grid-cols-3 gap-8` |
| 2-col OS / side-project grid | `grid grid-cols-1 md:grid-cols-2 gap-6` |
| Image / caption | `flex flex-col items-center gap-2` |

`<Columns count={n}>` and `<Grid cols={n}>` must resolve to these classes (safelist `md:grid-cols-1` through `md:grid-cols-4`).

## 3. Motion

### 3.1 Enter animation

All catalog components share one enter animation defined in `lib/jsonui/motion.ts`:

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

Rules:

- Wrap every component root in `motion.*` with `variants={enter} initial="hidden" animate="show"`.
- For lists, pass `custom={index}` to each child to stagger by 60 ms.
- Do **not** invent new spring values; if a component needs different motion, extend `lib/jsonui/motion.ts` and document it here.

### 3.2 Layout / streaming motion

The `<PortfolioCanvas>` cross-fades between home and answer specs:

```tsx
<motion.div
  key={viewKey}
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -12 }}
  transition={{ duration: 0.35 }}
  layout
>
```

Inside the canvas, individual components still use the `enter` stagger. Do not add extra mount animations to streaming chunks; `enter` is sufficient.

### 3.3 Hover motion

Use the built-in FrostedGlassBox effects:

- `hoverEffect="lift"` for cards and pills (subtle `hover:-translate-y-1 hover:shadow-xl`).
- `hoverEffect="glow"` for CTAs or featured items.
- `hoverEffect="none"` for static badges or disabled states.

Media cards implement their own scale:

```tsx
className="transition-all hover:scale-105 hover:shadow-lg"
```

### 3.4 Dark-mode handling

Do **not** add per-component `MutationObserver` logic. A shared `useIsDark()` helper already exists in `lib/jsonui/components/facts.tsx`; extract it to `lib/jsonui/use-is-dark.ts` in #29 and reuse everywhere. It watches `document.documentElement.classList` for `dark`.

## 4. Component boundaries

### 4.1 Primitives (`lib/jsonui/components/primitives.tsx`)

| Component | Responsibility | Contract |
|-----------|----------------|----------|
| `<Section>` | Full-width vertical chapter | `py-20`, `container mx-auto px-4`, optional `text-3xl font-bold mb-8` title, `motion.section` with `enter`. |
| `<Stack>` | Vertical rhythm wrapper | `space-y-*` based on `gap` prop, `motion.div` with `enter`. |
| `<Columns>` | Responsive multi-column layout | `grid gap-12 md:grid-cols-{count}` (max 3). |
| `<Grid>` | Dense card grid | `grid gap-6 grid-cols-1 md:grid-cols-{cols}` (max 4). |
| `<Prose>` | Narrative paragraph | `text-gray-700 dark:text-gray-300 mb-6 max-w-2xl`, `motion.p` with `enter`. |
| `<Heading>` | Subsection heading | `text-2xl font-semibold mb-4`. Level clamped 1–4. |
| `<Callout>` | Highlighted box | `rounded-xl border-l-4 p-4`, tone maps to `info`/`success`/`warn` colors, `motion.div` with `enter`. |
| `<Quote>` | Pull quote | `border-l-2 border-gray-300 dark:border-gray-700 pl-4 italic`, optional cite footer. |

### 4.2 Facts (`lib/jsonui/components/facts.tsx`)

| Component | Responsibility | Contract |
|-----------|----------------|----------|
| `<ProjectShowcase>` | Media cards for projects | Solid gray cards, `rounded-2xl overflow-hidden`, image `h-48 object-cover`, tech pills from §2.2, staggered `enter`. |
| `<SkillGrid>` | Categorized skill pills | Subsection heading per category + `FrostedGlassBox` pills (§2.1 pill props). |
| `<SkillCloud>` | Flat skill pill cloud | Same pills as `SkillGrid`, no category headings. |
| `<CareerTimeline>` | Work history | Left border timeline, `motion.li` staggered `enter`, company link uses accent colors. |
| `<ContactCard>` | Contact links | 3-col grid of `FrostedGlassBox` cards (§2.1 raised card props), large icon + title + link. |
| `<StatCallout>` | Big metric | `motion.div` with `enter`, big value + caption, optionally wrapped in `FrostedGlassBox`. |

### 4.3 Personality (`lib/jsonui/components/extras.tsx`)

| Component | Responsibility | Contract |
|-----------|----------------|----------|
| `<LottieFigure>` | Decorative animation | Centered figure, `w-full max-w-sm`, optional caption. |
| `<SpotifyNowPlaying>` | Live Spotify tile | Reuses existing `<SpotifyReveal />`; keep its styling untouched. |
| `<ImageBlock>` | Image + caption | `rounded-xl` image, centered, optional caption. |
| `<StepFlow>` | Numbered explanation | `motion.ol` with staggered `motion.li`, numbered badge `w-8 h-8 rounded-full bg-blue-500 text-white`. |

## 5. Answer layouts vs. home layouts

### 5.1 Home layout

- Rendered by `homeSpec.ts`.
- Full-width `<Section>` stack.
- Uses all fact components: `<SkillGrid>`, `<CareerTimeline>`, `<ProjectShowcase>`, `<ContactCard>`.
- Each section owns its own grid and container.

### 5.2 Answer layout

- Generated by `/api/generate`.
- Canvas wraps the renderer in a **centered reading column**: `mx-auto w-full max-w-3xl px-4 py-16`.
- Therefore generated specs should **not** use `<Section>` (it adds `py-20` and full-width container). Instead use:
  - `<Stack gap="md">`
  - `<Heading>` / `<Prose>`
  - `<SkillCloud>` for compact skill answers
  - `<Callout>`, `<Quote>`, `<StatCallout>` for emphasis
  - `<ImageBlock>` / `<LottieFigure>` for personality
- Fact components used in answers (e.g. `<ProjectShowcase slug="...">`) should render **inside** the column without their own outer section wrappers.

## 6. Prompt guidance for the model

When composing the catalog prompt for `/api/generate`, append these rules:

1. Prefer `Stack` + `Heading` + `Prose` for answer layouts; reserve `Section` for home-view specs.
2. Use `FrostedGlassBox`-based components (`SkillCloud`, `ContactCard`, `Callout`) for a consistent frosted-glass feel.
3. Choose `blue` as the default accent; only use `emerald`, `purple`, `amber`, `gold`, or `rose` when the content semantically calls for it.
4. Keep motion implicit — every component animates in automatically; do not add custom `motion` props.
5. Generated text should be concise (1–2 paragraphs) and use `Prose` for readability inside `max-w-3xl`.

## 7. Acceptance checklist for #29 and #30

- [ ] All catalog components use the `enter` animation from `lib/jsonui/motion.ts`.
- [ ] All cards follow §2.1 (frosted glass) or §2.2 (solid media) consistently.
- [ ] `Section` matches §2.3 wrapper exactly.
- [ ] `Columns`/`Grid` match §2.4 classes.
- [ ] Typography uses only the scale in §1.4.
- [ ] Dark-mode icons/images use the shared `useIsDark()` helper.
- [ ] The `_prototype.tsx` storyboard still renders identically after changes.

## 8. Open questions moved to downstream tickets

- Exact shadcn primitives to adopt in #30 (Button, Card, Badge, Separator) — this contract describes the *visual outcome*, not the library source.
- Tailwind v4 token migration details — #25 owns the config; this contract uses v3.4 classes that map 1:1 to v4 utilities.
- Additional fact/personality components (e.g. OS grid, FunFacts ticker) — propose in #29 or #30 after this contract lands.
