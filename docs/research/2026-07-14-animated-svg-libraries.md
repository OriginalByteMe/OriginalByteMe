# Animated SVG and vector-animation libraries for Motion Assets

**Date:** 2026-07-14  
**Scope:** React 19 / Next.js 15 options for a curated Motion Asset Catalog that JSON-generated Specs may reference. Sources are first-party documentation, repositories, package metadata, and licenses, accessed 2026-07-14. GitHub star counts below are point-in-time maintenance/adoption signals, not quality scores.

## Executive decision

Use a two-tier stack that the repository already carries in [`noah-portfolio/package.json`](../../noah-portfolio/package.json):

1. **Motion/Framer Motion + local SVG/React components** for icons, line drawing, morphing, and scroll/interaction choreography.
2. **`@lottiefiles/dotlottie-react` + self-hosted, vetted `.lottie` files** only for richer pre-authored sequences that would be expensive to reproduce as JSX/SVG.

Keep `lucide-react` as the geometric source for ordinary icons and author a small set of local Motion wrappers. AnimateIcons is the best external component source to evaluate icon-by-icon, but copy/adapt only approved components with their MIT notice and provenance instead of exposing its whole catalog to generated Specs. Do **not** add Rive, plain `lottie-react`, Anime.js, GSAP, or `pqoqubbw/icons` to the runtime now.

This recommendation minimizes runtime proliferation: the app already declares `framer-motion`, `lucide-react`, and `@lottiefiles/dotlottie-react` in its own [package manifest](../../noah-portfolio/package.json), while still covering code-authored SVG and designer-authored vector playback.

## Comparison

| Candidate | Authoring and React/Next integration | Runtime license vs asset license | Accessibility and runtime cost | Catalog fit / evidence |
|---|---|---|---|---|
| **Motion / Framer Motion** | Direct JSX/SVG authoring. Motion provides `motion` forms of every SVG element, animates SVG attributes and `viewBox`, normalizes SVG transform origins, supports 0–1 `pathLength`/`pathSpacing`/`pathOffset`, and can morph similar `d` paths ([official SVG guide](https://motion.dev/docs/react-svg-animation)). It documents a React Server Component import (`motion/react-client`) and server-rendered initial state ([component docs](https://motion.dev/docs/react-motion-component#server-side-rendering)); hooks and event-driven wrappers still belong behind a client boundary. | **Runtime:** MIT ([official repository](https://github.com/motiondivision/motion), 32,794 stars at access). **Assets:** not supplied by the runtime; each local SVG remains first-party or retains its source license. Lucide geometry is ISC ([Lucide repository/license](https://github.com/lucide-icons/lucide#license)). | Best built-in reduced-motion story: `MotionConfig reducedMotion="user"` disables transform/layout animation while preserving values such as opacity, and `useReducedMotion` supports custom static/fade behavior ([accessibility guide](https://motion.dev/docs/react-accessibility)). Official Rollup figures put `motion` at 34 kB and a LazyMotion initial render just under 4.6 kB; actual application output must be measured, and the dependency is already present ([bundle guide](https://motion.dev/docs/react-reduce-bundle-size)). | **Best default.** Local components are reviewable, tree-shakable, styleable, and easy to map to a stable ID. No opaque asset parser or editor workflow. The official repo is active and describes the React package as first-class ([repository](https://github.com/motiondivision/motion)). |
| **dotLottie React (`@lottiefiles/dotlottie-react`)** | First-party React canvas component for Lottie JSON and compressed `.lottie` archives; `.lottie` can aggregate animations and resources ([React README](https://github.com/LottieFiles/dotlottie-web/blob/main/packages/react/README.md)). The current implementation declares `'use client'`, creates/destroys a player around a canvas, and forwards canvas props ([React source](https://github.com/LottieFiles/dotlottie-web/blob/main/packages/react/src/base-dotlottie-react.tsx)). The official repo describes SSR-safe/Next support, Rust+WASM/ThorVG, software/WebGL2/WebGPU backends, and a worker/OffscreenCanvas option ([repository](https://github.com/LottieFiles/dotlottie-web)). | **Runtime:** MIT ([official repository](https://github.com/LottieFiles/dotlottie-web), 825 stars). **Format/file:** the container format being open does not license an animation inside it. Free LottieFiles marketplace animations use the separate Lottie Simple License; it allows product use/modification but forbids standalone redistribution/resale and says to check each animation page ([official licensing guide](https://help.lottiefiles.com/animation-licensing-basics-)). First-party `.lottie` files are preferred for a public repository. | No documented automatic `prefers-reduced-motion` behavior in the React API; `autoplay` defaults false and the exposed instance supports play/pause/stop, so the host must gate playback and supply a static fallback ([React README](https://github.com/LottieFiles/dotlottie-web/blob/main/packages/react/README.md#custom-playback-controls)). Canvas content needs explicit decorative hiding or an accessible name/description in surrounding HTML. Cost is a separate WASM renderer and canvas pipeline; worker rendering can move work off the main thread ([official repo architecture](https://github.com/LottieFiles/dotlottie-web#why-dotlottie-web)). No unsourced byte estimate is assumed. | **Best secondary player.** Already installed. Good for a small number of locally bundled, audited sequences. Specs must select a registry ID, never provide `src`, raw JSON, or a remote URL. Repository metadata and first-party multi-framework packages are a positive maintenance signal ([repository](https://github.com/LottieFiles/dotlottie-web)). |
| **Plain Lottie: `lottie-react` + `lottie-web`** | `lottie-react` is a community React component/hook around Airbnb's `lottie-web` ([wrapper README](https://github.com/Gamote/lottie-react)). `lottie-web` parses After Effects/Bodymovin JSON and renders via SVG, canvas, or HTML with imperative playback controls ([official Airbnb repository](https://github.com/airbnb/lottie-web#html-player-installation)). The wrapper source imports `lottie-web`, uses DOM refs/effects, and has no `'use client'` directive, so use requires a local client wrapper in Next ([hook source](https://github.com/Gamote/lottie-react/blob/master/src/hooks/useLottie.tsx)). | **Runtime:** both `lottie-react` and `lottie-web` publish MIT licenses ([wrapper license](https://github.com/Gamote/lottie-react/blob/master/LICENSE), [Airbnb license](https://github.com/airbnb/lottie-web/blob/master/LICENSE.md)). **Assets:** the same separate creator/marketplace license rules apply; LottieFiles explicitly distinguishes free, premium, public-upload, and private-upload terms ([official licensing guide](https://help.lottiefiles.com/animation-licensing-basics-)). | No wrapper-level reduced-motion API is documented; the exposed pause/stop methods make a manual policy possible ([wrapper source](https://github.com/Gamote/lottie-react/blob/master/src/hooks/useLottie.tsx)). SVG rendering can expose DOM nodes, but the animation still needs explicit accessible semantics or decorative hiding. Adding it here would introduce a second Lottie player beside the installed dotLottie player; no comparative byte claim is made. | **Reject for this repo.** It duplicates the existing player while accepting only the older JSON-centered pipeline. The wrapper README says v3 is unfinished because maintainers are busy ([maintenance note](https://github.com/Gamote/lottie-react#license)); Airbnb's underlying `lottie-web` itself remains strongly adopted (32,008 repository stars at access) but does not remove wrapper duplication ([repository](https://github.com/airbnb/lottie-web)). |
| **Rive React** | Official React wrapper over the JS/WASM runtime ([repository](https://github.com/rive-app/rive-react), 1,140 stars). It renders `.riv` files and exposes hooks/components for animations, state machines, events, and data binding; the current guide installs `@rive-app/react-webgl2` and renders into a canvas ([React guide](https://rive.app/docs/runtimes/react/react)). Canvas2D and lite variants exist, with feature/fidelity tradeoffs ([renderer guide](https://rive.app/docs/runtimes/choose-a-renderer/overview)). Treat it as a client-only canvas/WASM boundary in Next. | **Runtime:** official runtimes are MIT ([runtime licensing](https://rive.app/docs/runtimes/getting-started#licensing)). **Authoring/export:** the runtime license does not cover the editor workflow; `.riv` runtime export is available only on paid plans ([export guide](https://rive.app/docs/editor/exporting/exporting-for-runtime)). **Assets:** Marketplace files are CC BY, requiring attribution ([Marketplace docs](https://rive.app/docs/community/marketplace-overview)); owned private files need their own provenance record. | Official guidance says to detect reduced motion and call `pause`, use `autoplay: false`, or load a lower-motion artboard/state machine; it also recommends pausing offscreen animations and testing constrained devices ([best practices](https://rive.app/docs/getting-started/best-practices#pausing-programmatically)). Runtime cost is an additional JS/WASM engine plus selected Canvas2D or Rive/WebGL renderer; Rive warns that unoptimized `.riv` files and assets can consume significant resources ([best practices](https://rive.app/docs/getting-started/best-practices)). | **Technically strongest for interactive state machines, but not justified now.** It adds an authoring service/paid export constraint and another binary renderer for a catalog whose immediate need is curated icons and short illustrations. Reconsider only when a concrete asset requires state machines/data binding that Motion + dotLottie cannot express cleanly. |
| **AnimateIcons (`@animateicons/react` / source-copy)** | The official repo currently documents 281 React SVG icons, package imports, a CLI/source-copy path, and Motion-based implementation ([repository README](https://github.com/Avijit07x/animateicons), 983 stars). A sampled current component is a `'use client'` Motion component using `LazyMotion`, imperative start/stop, hover triggers, and `useReducedMotion` ([Bell source](https://github.com/Avijit07x/animateicons/blob/main/icons/lucide/bell-icon.tsx)). | **Components/choreography:** MIT with required copyright/license retention ([license](https://github.com/Avijit07x/animateicons/blob/main/LICENSE)). **Base vectors:** for the Lucide subset, retain Lucide's ISC provenance as well ([Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE)). Do not assume the same base-asset license for other subsets without checking them. | Sampled current source gates animation for reduced motion and uses LazyMotion, but every selected icon must be audited rather than inferring catalog-wide behavior from one file ([Bell source](https://github.com/Avijit07x/animateicons/blob/main/icons/lucide/bell-icon.tsx)). Installing the package would bring its Motion dependency; copying a few vetted components into the existing animation stack avoids exposing an entire library and keeps runtime behavior reviewable ([README](https://github.com/Avijit07x/animateicons#quick-start)). | **Approved as an intake source, not as an open-ended Spec namespace.** Curate only needed Lucide-based icons, pin the upstream revision, preserve notices, normalize their API/reduced-motion behavior, and register local wrappers under project-owned IDs. The source tree, tests, package, and recent catalog structure are concrete maintenance signals ([repository layout](https://github.com/Avijit07x/animateicons#repository-layout)). |
| **`pqoqubbw/icons` / lucide-animated** | Large source-copy collection of Motion React components; its repository has 7,784 stars at access and calls itself a work in progress ([repository](https://github.com/pqoqubbw/icons)). A representative Waves component is `'use client'`, uses `motion.path`, and exposes hover/imperative controls ([source](https://github.com/pqoqubbw/icons/blob/main/icons/waves.tsx)). | **Ambiguous for redistribution:** the repository has an MIT `LICENSE` ([license](https://github.com/pqoqubbw/icons/blob/main/LICENSE)), but its README separately says tutorials/demos cannot be redistributed or resold ([Terms of Use](https://github.com/pqoqubbw/icons#terms-of-use)). Those terms conflict with treating the repository as a clean redistributable catalog source; clarification is required. Underlying Lucide geometry is separately ISC ([Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE)). | The sampled Waves component has no reduced-motion check and directly imports Motion; a project wrapper would need to add policy ([source](https://github.com/pqoqubbw/icons/blob/main/icons/waves.tsx)). Source copying avoids a player runtime but creates review and license-tracking work. | **Reject pending license clarification.** Star count does not outweigh conflicting redistribution language or inconsistent accessibility behavior. Do not ingest it into a public catalog unless a specific component is cleared and provenance is documented. |
| **Anime.js 4** | General imperative JavaScript engine for CSS, SVG, DOM attributes, and objects, with ESM modules ([official repository](https://github.com/juliangarnier/anime), 70,968 stars). It is not a React asset library; a React integration must own refs, setup, teardown, hydration boundaries, and animation state. | **Runtime:** MIT ([license](https://github.com/juliangarnier/anime/blob/master/LICENSE.md)). **Assets:** none; SVGs remain first-party or separately licensed. | No React reduced-motion abstraction is supplied by the project overview; the host must use `matchMedia`, disable/replace timelines, and clean them up. It would add a second choreography engine next to Motion. No unsourced size comparison is made. | **Reject for this repo.** Credible, active, and highly adopted, but Motion already supplies the required React/SVG choreography with better Next and reduced-motion integration. |

## Runtime license is not asset license

The catalog must record both independently:

- An MIT player permits use of the **player code**; it does not grant rights to a downloaded `.json`, `.lottie`, `.riv`, or SVG.
- Free LottieFiles animations use the **Lottie Simple License**, which permits use in products but restricts standalone redistribution/resale and instructs consumers to check each asset page ([LottieFiles licensing](https://help.lottiefiles.com/animation-licensing-basics-)). A public source repository should therefore default to first-party animations and admit marketplace files only after a per-file redistribution review.
- Rive runtimes are MIT, but Marketplace files are **CC BY** and runtime export from the editor requires a paid plan ([runtime license](https://rive.app/docs/runtimes/getting-started#licensing), [Marketplace license](https://rive.app/docs/community/marketplace-overview), [export constraint](https://rive.app/docs/editor/exporting/exporting-for-runtime)).
- Motion does not bring artwork. Locally authored SVG is first-party; Lucide paths are **ISC** ([Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE)); copied AnimateIcons choreography is **MIT** and its notice must be retained ([AnimateIcons license](https://github.com/Avijit07x/animateicons/blob/main/LICENSE)).
- `pqoqubbw/icons` is not safe to treat as simply MIT because its README's redistribution restriction conflicts with its license file ([README terms](https://github.com/pqoqubbw/icons#terms-of-use), [MIT file](https://github.com/pqoqubbw/icons/blob/main/LICENSE)).

A catalog entry is publishable only when both runtime and asset/choreography rights are recorded. “Found on LottieFiles/GitHub” is not provenance.

## Proposed allowlisted Motion Asset Catalog contract

Generated JSON should contain only a validated project-owned ID, for example:

```json
{
  "type": "motionAsset",
  "assetId": "icon.bell.ring"
}
```

The trusted application registry—not the generated Spec—owns renderer selection, code/file location, playback, accessibility, and licensing:

```ts
type MotionAssetRecord = {
  id: "icon.bell.ring" | "illustration.profile-orbit";
  renderer: "motion-svg" | "dotlottie";
  localSource:
    | { componentKey: "BellRingAsset" }
    | { file: "/motion/profile-orbit.v3.lottie"; animationId?: string };
  intrinsicSize: { width: number; height: number };
  playback: {
    autoplay: boolean;
    loop: boolean;
    trigger: "none" | "hover" | "focus" | "in-view";
  };
  reducedMotion:
    | { mode: "static"; fallbackComponentKey: string }
    | { mode: "frame"; frame: number };
  accessibility:
    | { decorative: true }
    | { decorative: false; label: string; description?: string };
  provenance: {
    sourceUrl: string;
    upstreamRevision?: string;
    creator: string;
    assetLicense: "First-Party" | "ISC" | "MIT" | "Lottie-Simple" | "CC-BY-4.0";
    runtimeLicense: "MIT";
    noticePath?: string;
    reviewedAt: string;
  };
};
```

Enforcement rules:

1. Derive the Spec schema's `assetId` enum from the reviewed registry keys (or validate with `assetId in motionAssets`) and reject unknown IDs before rendering.
2. Never accept a component name, import path, `.riv`/`.lottie` URL, raw Lottie JSON, renderer discriminator, autoplay/loop flag, or arbitrary props from generated JSON. This prevents a Spec from bypassing review or turning the renderer into a remote-asset loader.
3. Store player files locally and pin copied source to an upstream commit/revision. Reject nested remote images/fonts/audio at intake unless separately downloaded, licensed, and allowlisted.
4. Keep playback policy registry-owned. Decorative loops default to `autoplay: false`, `loop: false`; any exception needs an explicit reduced-motion fallback and offscreen pause behavior.
5. For canvas players, put meaning in ordinary HTML and mark decorative canvases hidden. For meaningful animation, provide a static equivalent and stable text label/description; never rely on motion alone to communicate state.
6. Asset review records must preserve notices and attribution requirements. CC BY assets need creator attribution; Lottie Simple assets need an explicit repository-redistribution decision; ambiguous licenses are rejected.

## Ranked shortlist

1. **Motion + project-owned SVG components** — best catalog seam, strongest Next/SSR and reduced-motion support, no new engine, and full source-level reviewability ([SVG](https://motion.dev/docs/react-svg-animation), [SSR](https://motion.dev/docs/react-motion-component#server-side-rendering), [accessibility](https://motion.dev/docs/react-accessibility)).
2. **dotLottie React for selected complex sequences** — already installed, first-party React client component, supports local JSON/`.lottie`, controls, workers, and compressed multi-asset files; require self-hosting and manual reduced-motion/static fallback ([React README](https://github.com/LottieFiles/dotlottie-web/blob/main/packages/react/README.md), [client source](https://github.com/LottieFiles/dotlottie-web/blob/main/packages/react/src/base-dotlottie-react.tsx)).
3. **AnimateIcons as a vetted source donor** — useful pre-authored Motion icon choreography with clear MIT terms and a current reduced-motion implementation in sampled source; copy only approved Lucide-based components and retain MIT + ISC notices ([repository](https://github.com/Avijit07x/animateicons), [sample source](https://github.com/Avijit07x/animateicons/blob/main/icons/lucide/bell-icon.tsx), [license](https://github.com/Avijit07x/animateicons/blob/main/LICENSE)).
4. **Rive, conditional future option** — use only when a named requirement needs interactive state machines/data binding and accepts paid editor export, CC BY attribution where relevant, and another WASM/canvas renderer ([React capabilities](https://rive.app/docs/runtimes/react/react), [export constraint](https://rive.app/docs/editor/exporting/exporting-for-runtime)).

## Explicit non-adoptions

- **Do not add `lottie-react`**: it duplicates the installed dotLottie player and its own README records limited maintainer availability ([wrapper README](https://github.com/Gamote/lottie-react)).
- **Do not add Anime.js**: sound general SVG engine, but redundant beside the existing React-native Motion layer ([official repository](https://github.com/juliangarnier/anime)).
- **Do not ingest `pqoqubbw/icons`** until its MIT file and README redistribution restriction are clarified ([license](https://github.com/pqoqubbw/icons/blob/main/LICENSE), [terms](https://github.com/pqoqubbw/icons#terms-of-use)).
- **Do not add GSAP to an open-source shortlist**: its current Standard License is a custom use license with prohibited competitive uses, not an OSI-style permissive runtime license ([official GSAP Standard License](https://gsap.com/community/standard-license/)). Motion already covers the required SVG scope.
- **Do not add Rive now**: open-source runtime does not erase paid runtime-export and separate Marketplace-asset obligations ([runtime license](https://rive.app/docs/runtimes/getting-started#licensing), [export](https://rive.app/docs/editor/exporting/exporting-for-runtime), [Marketplace](https://rive.app/docs/community/marketplace-overview)).

## Recommended implementation policy

Adopt the hybrid stack already present: **Motion SVG for the default path; dotLottie only for catalog entries that pass a complexity threshold**. Build a small local set of branded assets and animated Lucide wrappers first. Evaluate AnimateIcons only as an upstream source for individual motions, not as a generated-name surface. Every catalog addition must ship with a static/reduced-motion rendering, dimensions, deterministic playback policy, local source, provenance, and separate runtime/asset license fields.

That gives generated Specs useful visual variety while preserving the security boundary: the model chooses a semantic, allowlisted `assetId`; trusted application code decides what component or local file that ID can render.
