# Ask-Me Portfolio — design system conventions

This is Noah Rijkaard's **json-render catalog**: the components the Ask-Me
portfolio's LLM composes UIs from. They render a "nocturne" aesthetic — matte
cream/ink surfaces, restrained violet ink accents, serif display headings, and
mono kickers.

## Calling convention (important — not idiomatic React)

Every component takes a single **`props`** object plus optional **`children`**,
mirroring the JSON spec the app renders. Do **not** spread fields as top-level
attributes.

```jsx
import { Scene, ChapterHeading, NarrativeBeat, StatReveal } from "noah-portfolio";

<Scene props={{ id: "intro", align: "center" }}>
  <ChapterHeading props={{ kicker: "Chapter 01", text: "Noah, in brief" }} />
  <NarrativeBeat props={{ text: "Full-stack developer in Kuala Lumpur." }} />
  <StatReveal props={{ value: 6, suffix: " yrs", caption: "shipping software" }} />
</Scene>
```

Each component's exact `props` shape is in its `<Name>.d.ts` (`<Name>Props`)
and usage is in `<Name>.prompt.md`. Read those before composing.

## Layout vs. content vs. story vs. facts

- **Layout/content primitives** (`Section`, `Stack`, `Columns`, `Grid`,
  `Prose`, `Heading`, `Callout`, `Quote`) accept `children` and realistic text —
  compose freely.
- **Story primitives** (`Scene`, `ChapterHeading`, `NarrativeBeat`,
  `StatReveal`, `SequencedTimeline`) build a scroll-driven narrative. Cap a
  `Scene` at 2–3 children: one `ChapterHeading` anchor + one payload.
- **Fact components** (`ProjectShowcase`, `SkillGrid`, `SkillCloud`,
  `CareerTimeline`, `OperatingSystemsGrid`, `ContactCard`) are **corpus-bound**:
  they read data via `props.statePath` (e.g. `"/corpus/projects"`,
  `"/corpus/skills"`, `"/corpus/careerTimeline"`, `"/corpus/operatingSystems"`,
  `"/corpus/contact"`). They render **empty without a json-render
  `StateProvider`** supplying that state — the preview cards inject Noah's real
  corpus. `SequencedTimeline` also accepts inline `props.rows` instead of a
  statePath; prefer that when you don't have corpus state.

## Styling idiom — Tailwind v4 + the nocturne palette

Components are styled with **Tailwind v4 utility classes** and arbitrary color
values from a fixed palette. To match the look in your own layout glue, use
these exact values (light mode; each has a dark counterpart):

| Role | Value |
|---|---|
| Ink / heading text | `text-[#37304a]` (dark: `#eae6f2`) |
| Muted body text | `text-[#5d5673]` (dark: `#bdb6d0`) |
| Mono kicker / label | `text-[#6f6885]` |
| Primary surface (card) | `bg-[#fffdf8]` (dark: `#2b2830`) |
| Secondary surface / chip | `bg-[#f4ecdf]` (dark: `#26232c`) |
| Violet accent (emphasis) | `#7a5fa0`, deeper `#5646a8` (dark: `#c9b3ec` / `#9d8ff2`) |
| Card radius / shadow | `rounded-3xl` + `shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)]` |

Serif is the **display** treatment (`font-serif`, from `--story-display-font`);
**mono** (`font-mono`, uppercase, wide tracking) is for kickers, labels, and
badges. Accents come only from the fixed violet/mint allowlist — never a
free-form hue.

CSS design tokens are also available as `var(--*)`: the `--story-*` family
(`--story-ink`, `--story-muted`, `--story-accent`, `--story-surface`,
`--story-border`, `--story-space-1..24`, `--story-radius-sm/md/pill`) and shadcn
semantic tokens (`--primary`, `--secondary`, `--border`, `--muted`, `--accent`,
`--background`, `--foreground`, `--ring`), used via utilities like
`bg-secondary`, `border-border`, `text-primary`.

## Where the truth lives

- `styles.css` — the single stylesheet entry; it `@import`s the compiled
  Tailwind utilities, the nocturne tokens, and the component styles. Read it
  (and its imports) before inventing new class names.
- `<Name>.prompt.md` / `<Name>.d.ts` — per-component usage and API.
