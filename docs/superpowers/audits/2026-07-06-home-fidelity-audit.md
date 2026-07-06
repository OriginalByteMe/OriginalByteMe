# Home-View Fidelity Audit: `main` vs `feat/ask-me-dynamic-portfolio`

**Ticket:** [#27 Audit fidelity gaps vs the main-branch portfolio](https://github.com/OriginalByteMe/OriginalByteMe/issues/27)  
**Branch:** `feat/ask-me-dynamic-portfolio`  
**Date:** 2026-07-06  
**Auditor:** Fidelity Auditor  

## Scope

Compare the original `main`-branch portfolio sections below the hero (`About` → `Projects` → `Contact`) with the json-render home canvas on `feat/ask-me-dynamic-portfolio` (`lib/jsonui/homeSpec.ts` + `lib/jsonui/catalog.ts` + `lib/jsonui/registry.tsx` + `lib/jsonui/components/*.tsx`).

The hero, shell, lava-lamp background, and theme switch are **out of scope** — they are plain React in both branches. Only the default (no-question) body canvas is audited.

## Method

1. Read `main:noah-portfolio/app/page.tsx`, `components/About.tsx`, `components/Projects.tsx`, `components/Contact.tsx`.
2. Read `feat/ask-me-dynamic-portfolio` equivalents: `noah-portfolio/lib/jsonui/homeSpec.ts`, `lib/jsonui/catalog.ts`, `lib/jsonui/registry.tsx`, `lib/jsonui/components/{primitives,facts,extras}.tsx`.
3. Read the seeded corpus in `content/about-me/*.md` and `lib/corpus/types.ts` to check data drift.
4. Compare markup, spacing/framing, hierarchy, icons, hover states, and animation.

## Executive summary

The catalog already reproduces the **Projects** and **Contact** sections well, and the **Skills / Work History** portions of **About** are structurally close. The biggest gaps are:

1. **Operating-systems grid is missing entirely** from `homeSpec` and from the catalog.
2. **Side-projects grid (3D printing + blog) is missing entirely** from `homeSpec` and has no corpus/component mapping.
3. **Section framing is inconsistent**: `main` centers `Projects` and `Contact` full-viewport, while the current `Section` primitive always uses `py-20` top-level.
4. **Sub-section headings are missing** in `SkillGrid`/`CareerTimeline` (Skills/Work History titles with icons).
5. **Tailwind dynamic-class bug** in `Columns`/`Grid` primitives may break responsive grids at runtime.
6. **Content drift**: the bio paragraph in `homeSpec` is hard-coded, and side-project assets are not in the corpus.
7. **Animation differs by design** (main is static; feature uses framer-motion) — this is intentional per the design doc, but should be listed as a known delta.

No production code is broken by this audit; all findings are documented, and fixes are ticketed for #29.

## Side-by-side inventory

| Area | `main` behavior | Current json-render behavior | Fidelity gap | Severity | Fix type |
|---|---|---|---|---|---|
| **Page structure** | `Hero → About → Projects → Contact` inside one `relative z-10` wrapper. | `Hero → PortfolioCanvas` renders `homeSpec`: `Stack(About, Projects, Contact)`. | Equivalent top-level ordering. | None | — |
| **About section heading** | `h2 "About Me"` with `mb-8`. | `Section` renders `h2` with `mb-8`. | Matches. | None | — |
| **About intro paragraph** | `p` `text-gray-700 dark:text-gray-300 mb-12 max-w-2xl`. | `Prose` renders `p` with `mb-6 max-w-2xl`. | Bottom margin off (`mb-12` vs `mb-6`). | Low | Catalog tweak (`Section`/`Prose` spacing props) |
| **Skills heading** | `h3` with `Code` icon, `text-2xl font-semibold mb-4`. | No heading rendered; `SkillGrid` starts directly with categories. | Missing "Skills" title + icon. | Medium | Catalog addition: optional `title`/`icon` on `SkillGrid`, or `SectionHeader` primitive |
| **Skills category icons** | Each category has a Lucide icon (`Terminal`, `Layout`, `Server`, `Database`). | Same icon mapping in `SkillGrid`. | Matches. | None | — |
| **Skill pills** | `FrostedGlassBox` `variant="blue" hoverEffect="lift" glassOpacity="light"` rounded-full pill with image + name. | `SkillPill` uses the same `FrostedGlassBox` props. | Matches. | None | — |
| **Work History heading** | `h3` with `Briefcase` icon, `text-2xl font-semibold mb-4`. | No heading rendered; `CareerTimeline` starts directly with list. | Missing "Work History" title + icon. | Medium | Catalog addition: optional `title`/`icon` on `CareerTimeline`, or `SectionHeader` primitive |
| **Work History items** | Border-left timeline, logo, company, role, period, external-link icon. | Same markup in `CareerTimeline`. | Matches. | None | — |
| **Operating Systems section** | Two `FrostedGlassBox` environment cards in a 2-column grid; each card shows environment icon+name and child OS pills. | **Not present** in `homeSpec`; no catalog component accepts `/corpus/operatingSystems`. | Entire section missing. | High | Catalog addition: `OperatingSystemsGrid` |
| **Side Projects section** | Two `FrostedGlassBox` cards (3D printing image + blog Lottie), blog card clickable. | **Not present** in `homeSpec`; no component renders the side-project content. | Entire section missing. | High | Escape-hatch component `SideProjects`, or catalog `FeatureCard` + corpus additions |
| **Projects section framing** | `section` with `min-h-screen flex flex-col items-center justify-center`. | `Section` uses `relative py-20` only. | `Projects` not vertically centered and not full-viewport. | Medium | Catalog addition: `Section` props for `height`/`centered` |
| **Projects heading margin** | `h2 "Projects"` with `mb-12`. | `Section` always uses `mb-8`. | Bottom margin off. | Low | Catalog tweak (`titleMb` or section variants) |
| **Project cards** | `a` card with image, title + hover arrow, description, tech pills (dark-mode-aware icons). | `ProjectShowcase` replicates markup and hover arrow; `useIsDark` switches icons. | Matches. | None | — |
| **Contact section framing** | `section` with `min-h-screen flex flex-col items-center justify-center`. | `Section` uses `relative py-20` only. | `Contact` not vertically centered and not full-viewport. | Medium | Catalog addition: `Section` props for `height`/`centered` |
| **Contact heading margin** | `h2 "Contact Me"` with `mb-12`. | `Section` always uses `mb-8`. | Bottom margin off. | Low | Catalog tweak |
| **Contact cards** | Three `FrostedGlassBox` cards, icons, labels, mailto/github/linkedin links. | `ContactCard` replicates cards and links. | Matches. | None | — |
| **Responsive grid classes** | Static Tailwind classes (`md:grid-cols-2`, etc.) present in source. | `Columns`/`Grid` build class names dynamically (`md:grid-cols-${count}`). | Tailwind may purge these classes, breaking responsive grids. | High | Catalog fix: use a literal class map or `cn` with safelisted variants |
| **Animations** | None (static HTML/CSS). | Every catalog component uses framer-motion `enter` variants (`opacity`/`y` with spring stagger). | Visual motion added. | N/A (intentional) | Document as accepted delta |

## Detailed findings

### 1. Missing operating-systems grid

`main/components/About.tsx` renders:

```tsx
<h3 className="text-2xl font-semibold mb-4 flex items-center">
  <Code className="mr-2" /> Operating Systems
</h3>
<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
  {operatingSystems.map((environment) => (
    <FrostedGlassBox className="p-6 rounded-xl shadow-sm" variant="blue" hoverEffect="lift" glassOpacity="heavy" key={environment.name}>
      {/* environment header icon + name */}
      {/* child OS pills */}
    </FrostedGlassBox>
  ))}
</div>
```

The corpus already has `content/about-me/operating-systems.md` with the exact data, and `lib/corpus/types.ts` defines `OperatingSystem[]`. But `homeSpec.ts` explicitly omits it because no component renders it:

> "Note: the static About section also renders an operating-systems grid (corpus `/corpus/operatingSystems`) — that's intentionally omitted here because no catalog component renders `OperatingSystem[]` yet."

**Recommendation:** Add a catalog component `OperatingSystemsGrid` (fact component) bound to `/corpus/operatingSystems`. This is a clear catalog addition — reusable, data-driven, and needed by the home view.

### 2. Missing side-projects grid

`main/components/About.tsx` renders a 2-column grid of two `FrostedGlassBox` cards:

- **3D Printing** — static `Image` (`/Noah Icon FA.svg`), heading, paragraph.
- **Blog** — `DotLottieReact` animation, heading with hover underline, paragraph, clickable to `https://blog.noahrijkaard.com`.

There is no corresponding component, no corpus entry for the 3D-printing image text, and `homeSpec` does not include the section. The blog URL exists in `contact.blog` but is not rendered anywhere.

**Recommendation:** This is best handled as an **escape-hatch component** (`SideProjects`) for Phase 1 because:
- The content is static and unique to the home view.
- It mixes an `Image`, a `DotLottieReact`, and a click handler in one layout.
- A generic catalog component would need to support Lottie, images, arbitrary click actions, and frosted-glass styling — over-engineering for one-off content.

If the model later needs to emit side-project-like cards for answers, promote it to a catalog `FeatureCard` in Phase 2.

### 3. Section framing / spacing mismatches

`main` uses two distinct section frames:

- **About**: `relative py-20` (top-aligned, content-height).
- **Projects / Contact**: `relative flex flex-col items-center justify-center min-h-screen` (full viewport, vertically centered).

The current `Section` primitive is defined as:

```tsx
<motion.section variants={enter} initial="hidden" animate="show" className="relative py-20">
  <div className="container mx-auto px-4">
    {props.title ? <h2 className="text-3xl font-bold mb-8">{props.title}</h2> : null}
    {children}
  </div>
</motion.section>
```

This makes all three sections top-aligned with `py-20` and `mb-8` titles. The visual rhythm of `Projects` and `Contact` is therefore flattened.

**Recommendation:** Extend the `Section` catalog component with optional props:

- `height?: "auto" | "screen"` → adds `min-h-screen` when `"screen"`.
- `centered?: boolean` → adds `flex flex-col items-center justify-center`.
- `titleMb?: "sm" | "md" | "lg"` (or a numeric enum) to match `mb-8`/`mb-12`.

This is a catalog addition. `homeSpec` can then set `height: "screen"` and `centered: true` for `Projects` and `Contact`.

### 4. Missing sub-section headings

In `main`, the left column of About has a `Skills` heading with a `Code` icon, and the right column has a `Work History` heading with a `Briefcase` icon. The current fact components (`SkillGrid`, `CareerTimeline`) render only the list/grid, not the title.

**Recommendation:** Two acceptable catalog additions:

- Add an optional `showTitle?: boolean` and `title?: string` to `SkillGrid`/`CareerTimeline` that renders the heading with the correct icon.
- Or add a `SectionHeader` primitive (text + optional icon name) that can be placed before any fact component.

The first option is more ergonomic for the model; the second is more flexible. Either satisfies the home view.

### 5. Dynamic Tailwind classes in layout primitives

`lib/jsonui/components/primitives.tsx`:

```tsx
Columns: ({ props, children }) => (
  <div className={`grid gap-12 md:grid-cols-${Math.min(3, props.count)}`}>{children}</div>
),
Grid: ({ props, children }) => (
  <div className={`grid gap-6 grid-cols-1 md:grid-cols-${Math.min(4, props.cols)}`}>{children}</div>
),
```

Tailwind scans source files for full class strings. `md:grid-cols-${count}` may not be generated, so `Columns count={2}` could render `md:grid-cols-2` without the CSS rule. This is a runtime fidelity bug, not just a visual mismatch.

**Recommendation:** Replace dynamic strings with a literal class map or use `cn` with explicitly safelisted classes. Example:

```tsx
const colClasses = { 1: "md:grid-cols-1", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };
```

This is a catalog fix, not a new component.

### 6. Data drift / hard-coded content

| Data | `main` | Corpus | Current `homeSpec` | Status |
|---|---|---|---|---|
| Bio paragraph | Hard-coded in `About.tsx` | `content/about-me/bio.md` body | Hard-coded in `aboutProse.props.text` | **Drift risk** — if corpus bio is edited, home view stays stale. |
| Skills | `skillCategories` array | `content/about-me/skills.md` | `/corpus/skills` | Matches. |
| Work history | `workHistory` array | `content/about-me/career.md` | `/corpus/careerTimeline` | Matches. |
| Operating systems | `operatingSystems` array | `content/about-me/operating-systems.md` | Not used | Missing component. |
| Projects | `projects` array | `content/about-me/projects/*.md` | `/corpus/projects` | Matches. |
| Contact | Hard-coded links | `content/about-me/contact.md` | `/corpus/contact` | Matches. |
| Side projects | Hard-coded cards | Not present | Not used | Missing component + corpus. |

**Recommendation:** For #29, bind `aboutProse` to a new `/corpus/bio` state path (or a `Prose` with `statePath`) so the default view stays in sync with the corpus. If `Prose` cannot read corpus, add a `Bio` fact component or a `statePath` prop to `Prose`.

### 7. Animation differences

`main` sections are static. The json-render catalog wraps every component in `motion.*` with `enter` variants (`opacity: 0 → 1`, `y: 12 → 0`, spring). This is an intentional design decision per the design doc ("Animation: framer-motion core"), but it means the home canvas is not pixel-identical to `main`.

**Recommendation:** Treat as accepted delta. Acceptance criteria for #29 should say "visual structure and content match `main`; motion is the intentional framer-motion enter animation."

## Acceptance criteria for #29 (Build faithful home canvas from catalog)

Derived from the audit above:

1. **`homeSpec` includes About → Projects → Contact in the same order as `main`.**
2. **About section**
   - [ ] Renders the bio paragraph from the corpus (no hard-coded text drift).
   - [ ] Renders a "Skills" sub-heading with the `Code` icon.
   - [ ] Renders categorized skill pills with the same icons/styling as `main`.
   - [ ] Renders a "Work History" sub-heading with the `Briefcase` icon.
   - [ ] Renders the career timeline with logo, role, period, and external-link icon.
   - [ ] Renders the **Operating Systems** grid: two environment cards, each with environment icon/name and child OS pills.
   - [ ] Renders the **Side Projects** grid: 3D-printing card and blog card (Lottie + clickable link).
3. **Projects section**
   - [ ] Section is vertically centered and at least full viewport height (`min-h-screen`, `items-center`, `justify-center`).
   - [ ] Heading bottom margin matches `main` (`mb-12`).
   - [ ] Project cards render image, title with hover arrow, description, and dark-mode-aware tech pills.
4. **Contact section**
   - [ ] Section is vertically centered and at least full viewport height.
   - [ ] Heading bottom margin matches `main` (`mb-12`).
   - [ ] Contact cards render icons, labels, and mailto/GitHub/LinkedIn links inside `FrostedGlassBox`.
5. **Layout primitives**
   - [ ] `Columns` and `Grid` responsive classes are literal Tailwind classes, not dynamic template strings.
6. **Motion**
   - [ ] Home canvas uses the existing framer-motion enter animation; static parity with `main` is not required.
7. **No regressions**
   - [ ] `homeSpec` still renders without validation errors when used as the fallback spec.
   - [ ] `ProjectShowcase`, `SkillGrid`, `CareerTimeline`, and `ContactCard` continue to work in generated answer specs.

## Catalog additions vs escape-hatch components

| Gap | Recommended fix | Type |
|---|---|---|
| Operating-systems grid missing | Add `OperatingSystemsGrid` fact component bound to `/corpus/operatingSystems` | **Catalog addition** |
| Section framing (full-height/centered) | Add `height`/`centered`/`titleMb` props to `Section` primitive | **Catalog addition** |
| Missing Skills/Work History sub-headings | Add optional `title`/`showTitle` to `SkillGrid`/`CareerTimeline`, or add a `SectionHeader` primitive | **Catalog addition** |
| Dynamic Tailwind classes broken | Refactor `Columns`/`Grid` to literal class maps | **Catalog fix** |
| Bio hard-coded in `homeSpec` | Add `/corpus/bio` state path support (extend `Prose` or add `Bio` component) | **Catalog addition** |
| Side-projects grid missing | Add `SideProjects` escape-hatch component (static, one-off) | **Escape-hatch component** |

## Assets produced

- This audit document: `docs/superpowers/audits/2026-07-06-home-fidelity-audit.md`
