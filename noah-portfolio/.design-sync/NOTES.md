# design-sync notes — Ask-Me Portfolio

## Shape & why this repo is off the beaten path

- The "design system" is the **json-render catalog** (`lib/jsonui/catalog.ts` +
  `lib/jsonui/registry.tsx`), living inside a **Next.js app** — there is no
  built `dist/` and no `.d.ts` exports. Components are **object properties** on
  the registry objects (`primitiveComponents`, `factComponents`,
  `extraComponents`, `storyComponents`), not named React exports.
- Everything the converter needs is scaffolded under `.design-sync/support/`:
  - `entry.tsx` — the `--entry` barrel: re-exports each catalog component as a
    real named export (untouched — `window.NoahPortfolio.<Name>` is the shipped
    registry component) plus `DesignPreviewProvider`.
  - `provider.tsx` — `DesignPreviewProvider` (cfg.provider): json-render
    StateProvider/ActionProvider/VisibilityProvider seeded with the baked
    corpus, plus a **minimal** redux store (spotify slice only) for
    SpotifyNowPlaying. Uses light mode (`useIsDark` defaults false).
  - `next-image.tsx` — shim for `next/image` (aliased in
    `tsconfig.designsync.json`): renders a plain `<img>`, strips next-only
    props, rewrites `/public` paths, and inlines the one hardcoded asset
    (`/Noah Icon FA.svg`) from `hardcoded-assets.ts`.
  - `corpus.json` — Noah's real corpus, baked from `content/about-me/` then with
    every image inlined as a data URI (see build steps).
- Components register + get clean `.d.ts` via `cfg.componentSrcMap` (pins each
  name to its source file) + `cfg.dtsPropsFor` (hand-written `<Name>Props`
  bodies — the json-render `{ props, children }` contract).
- Group is "jsonui" for all 24 (derived from `lib/jsonui/components/`). Cosmetic;
  refine later with per-component category docs if desired.

## Build steps (run in order before the converter)

Run from `noah-portfolio/`:

1. **Bake corpus:** `npx tsx .design-sync/support/bake-corpus.mts`
   (reads `content/about-me/` via the app loader → `corpus.json` with URLs).
2. **Inline images:** `NODE_PATH="$(pwd)/.ds-sync/node_modules" node .design-sync/support/inline-assets.mjs`
   (fetches every corpus image via `curl` through the proxy, inlines SVGs
   verbatim, downscales rasters via chromium → data URIs). **Re-run steps 1–2
   whenever `content/about-me/` changes.** Also regen `hardcoded-assets.ts`/
   `sample-image.ts` via `gen-datauris.mjs` if the hardcoded assets change.
3. **Compile Tailwind CSS:** `node .design-sync/support/compile-css.mjs`
   (`@tailwindcss/postcss` compiles `app/globals.css` scanning the component
   sources → `compiled.css`, the `cfg.cssEntry`). Re-run when component classes
   change so new utilities exist statically.
4. **Converter:** `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry .design-sync/support/entry.tsx --out ./ds-bundle`
   then `node .ds-sync/package-validate.mjs ./ds-bundle`.

## Playwright / capture

- Cached chromium is **build 1194** (`/opt/pw-browsers`). Install
  `playwright@1.56.0` into `.ds-sync/` (matches 1194); the app pins 1.61.1
  (chromium 1228 — mismatch, would fail to launch). NODE_PATH or run from a dir
  that resolves `.ds-sync/node_modules` first.
- **`package-capture.mjs` `settle()` is patched** with a `+1500ms`
  `waitForTimeout` so framer-motion count-ups (StatReveal, and Scene which
  embeds it) finish before the screenshot — otherwise they capture mid-count
  (e.g. "3 yrs" instead of "6 yrs"). This edit lives in the **staged**
  `.ds-sync/package-capture.mjs`, which is gitignored and re-copied on re-sync —
  **re-apply it after any `cp -r` of the skill scripts.**

## Fonts

- Serif display stack is `--story-display-font: "Iowan Old Style", "Palatino
  Linotype", Palatino, serif` — **system fonts**, not webfonts. Suppressed via
  `cfg.runtimeFontPrefixes`. Body sans is Inter (next/font, not shipped) →
  system sans fallback in the bundle. Accepted; not a defect.

## Known render warns

- `tokens: 1 missing, below threshold` — non-blocking; the shipped CSS
  references one `var(--*)` not defined in the closure (harmless).

## Re-sync risks (watch-list)

- **Corpus is inlined at sync time.** `corpus.json` is a baked snapshot of
  `content/about-me/` with images as data URIs. It goes stale silently if the
  content changes — re-run bake + inline (steps 1–2).
- **`jsdelivr @main` URLs.** `next-image.tsx` and `inline-assets.mjs` resolve
  `/public` assets from `cdn.jsdelivr.net/gh/OriginalByteMe/OriginalByteMe@main/
  noah-portfolio/public`. Pinned to `main`; breaks if those assets move/rename.
- **Capture settle patch** is in the gitignored staged script — see above.
- **State-bound components** (ProjectShowcase, SkillGrid, SkillCloud,
  CareerTimeline, OperatingSystemsGrid, ContactCard) render empty in any design
  that doesn't provide a json-render StateProvider with `/corpus/*` state. This
  is documented in the conventions header; it is inherent to the catalog.
- **Bundle size ~3.7 MB** because the preview corpus images are inlined as data
  URIs to make previews self-contained (the sandbox chromium can't reach CDNs,
  and it keeps the design pane network-free). Preview-only scaffolding rides in
  `_ds_bundle.js` via the provider. Lean it later by splitting the provider out
  if bundle weight matters.
- **Only light mode** is exercised in previews; dark image variants were mirrored
  to light in `corpus.json`.
