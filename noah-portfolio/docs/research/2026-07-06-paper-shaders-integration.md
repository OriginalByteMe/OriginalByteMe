# Paper Shaders integration constraints (`@paper-design/shaders-react`)

- **Ticket:** [#34](https://github.com/OriginalByteMe/OriginalByteMe/issues/34)
- **Date:** 2026-07-06
- **Version researched:** `0.0.77` (latest, published 2026-07-02), GitHub [`paper-design/shaders`](https://github.com/paper-design/shaders), docs at [shaders.paper.design](https://shaders.paper.design)
- **Target app:** Next.js 15.1 App Router, React 19, Tailwind 4

## TL;DR

Paper Shaders is safe to adopt for a single full-screen backdrop canvas. Components are
`'use client'`, render an empty `<div>` on the server, and hydrate cleanly — no
`dynamic(..., { ssr: false })` needed. `speed={0}` fully cancels the rAF loop (zero GPU
burn), so `prefers-reduced-motion` is a one-liner on the app side (the library does NOT
handle it). Prop changes map to `gl.uniform*` calls with a cheap diff — no program
recompile — so **steering = tweening props on one mounted component**. Switching shader
*types* (e.g. MeshGradient → Metaballs) is a full canvas/context remount with no built-in
transition; cross-fade by briefly stacking two canvases and fading DOM opacity, then
unmounting the loser. **Pin the exact version** — the maintainers ship breaking changes
under 0.0.x by policy. Cheapest→dearest on mobile of our candidates: ImageDithering,
Metaballs, MeshGradient, GrainGradient, HalftoneDots (gooey/soft variants are a
fill-rate bomb: up to 36 texture fetches + ~108 `exp()` per fragment).

---

## 1. SSR / hydration in Next.js 15 / React 19

- Both the published `dist/index.js` and source `packages/shaders-react/src/index.ts:1`
  begin with `'use client'` — every export is client-only by construction. A plain
  `import { MeshGradient } from '@paper-design/shaders-react'` inside any client
  component works; `next/dynamic` with `ssr: false` is **redundant** (harmless).
- No `window`/`document` access at module scope. On the server the component renders an
  **empty `<div>`** (`packages/shaders-react/src/shader-mount.tsx:200–236`); the canvas +
  WebGL2 context are created in a `useEffect` keyed on `fragmentShader`
  (`shader-mount.tsx:158–166`). The div matches on hydration → no mismatch warnings. A
  stray SSR warning was removed in v0.0.63 (CHANGELOG).
- The empty div means you can give it width/height styles server-side so the backdrop
  occupies space before hydration — but there is **no shader pixel output until JS runs**.
  Paint a CSS gradient underneath for first paint.
- **WebGL2 is required.** `canvas.getContext('webgl2')` failing throws
  `Error('Paper Shaders: WebGL is not supported in this browser')`
  (`packages/shaders/src/shader-mount.ts:~100–110`). No fallback prop, no error-boundary
  integration — wrap the backdrop in an error boundary that falls back to a static CSS
  gradient.
- `peerDependencies: { react: "^18 || ^19" }` — React 19 explicitly supported.

## 2. Bundle cost

Facts (npm registry, v0.0.77):

| Package | unpackedSize | Shape |
|---|---|---|
| `@paper-design/shaders-react` | 410 KB | ESM-only, `sideEffects: false`, single `.` export |
| `@paper-design/shaders` (dep) | 819 KB | ESM-only, `sideEffects: false` |

- No per-component subpath exports — everything routes through `index.js`. But dist is
  per-module files and `sideEffects: false`, so modern bundlers (Next/webpack) prune
  unused shader modules; each shader's GLSL lives in its own module
  (`packages/shaders/src/shaders/*.ts`) as a template string.
- Component wrappers are small (`mesh-gradient.js` ≈ 3.2 KB, `shader-mount.js` ≈ 4.7 KB).
- [INFERENCE] Realistic cost of importing one component: ~10–15 KB gzip for the React
  layer + the tree-shaken slice of the core package; worst case (poor tree-shaking, all
  shaders retained) on the order of 250–350 KB gzip. Verify with
  `next build` + bundle analyzer once installed; the unpacked sizes above are the only
  measured numbers.
- Using several shader types (our 5 candidates) keeps one copy of ShaderMount and adds
  only each shader's GLSL string + thin wrapper — marginal cost per extra shader is small.

## 3. Mobile GPU cost of the candidate shaders

All shaders are `#version 300 es` (WebGL2), `mediump` precision, full-screen fragment
work — **fill-rate dominated on mobile**. Sources: `packages/shaders/src/shaders/*.ts`.

| Rank | Shader | Cost drivers (per fragment) | Cost levers |
|---|---|---|---|
| 1 (cheapest) | **ImageDithering** (`image-dithering.ts:55–145`) | 1 texture fetch, const Bayer lookup, pure ALU; no loops, no trig | `pxSize`, `colorSteps` don't affect cost |
| 2 | **Metaballs** (`metaballs.ts:73–152`) | loop 1–20 iters (breaks at `u_count`), 2 cheap 1D noises + `pow` per iter, no textures | `count` scales cost linearly |
| 3 | **MeshGradient** (`mesh-gradient.ts:67–149`) | loop 1–10 iters, ~5 sin/cos + `pow(d,3.5)` per iter; distortion adds 2-iter trig loop; `fwidth` for grain | `colors.length`, `distortion`, `swirl` |
| 4 | **GrainGradient** (`grain-gradient.ts:79–370`) | 3-iter FBM ×4 = 12 noise-texture fetches, simplex noise (permute-heavy), 7-way shape branch | `shape` (blob/sphere ≈ 5× wave), `colors.length` |
| 5 (dearest) | **HalftoneDots** (`halftone-dots.ts:70–389`) | **nested loop 4–36 iters**, each with an image texture fetch + 3 `exp()` sigmoids → 4–36 fetches and 12–108 `exp()` per fragment | `type`: classic/holes = 4 iters; **gooey/soft = 36 iters (9×)**; hex `grid` adds branching |

Resolution handling (`packages/shaders/src/shader-mount.ts`):

- Renders at `max(devicePixelRatio, minPixelRatio) × visualViewport.scale`, where
  **`minPixelRatio` defaults to 2** — i.e. it deliberately oversamples on 1× screens.
- Total pixels capped by **`maxPixelCount`, default `1920 × 1080 × 4` ≈ 8.3 M** (canvas is
  downscaled uniformly past the cap).
- Both are React props on every component. These are the **dominant mobile cost levers**:
  drop `minPixelRatio={1}` and cap `maxPixelCount` (≈ 1–2 M pixels) for a backdrop —
  gradients/grain survive downscaling well.
- No adaptive/per-shader resolution logic exists; the app owns this knob.

## 4. Runtime preset switching & cross-fade

- **Prop → uniform:** changing props on a mounted component calls
  `setUniforms()` → per-key equality-checked `gl.uniform*` writes + immediate re-render
  (`shader-mount.ts:413–467, 560–566`). **No program recompile.** Changes **snap** — the
  library does zero interpolation.
- **Tweening from the app is viable:** setting React props per frame is fine — the wrapper
  memoizes (`memo` + `colorPropsAreEqual`) and the uniform cache skips no-op writes. For
  60 fps tweens prefer driving from one rAF loop and avoid allocating fresh arrays when
  values haven't changed. An imperative escape hatch exists
  (`parentElement.paperShaderMount.setUniforms(...)` via ref) but props suffice.
- **Same component, different preset** (e.g. MeshGradient `purplePreset` → `beachPreset`):
  animate uniforms — stays on one canvas/program. Note color arrays must keep the same
  length during a tween (uniform arrays are fixed-size; count is a uniform).
- **Different shader component** (MeshGradient → Metaballs): the `useEffect` keyed on
  `fragmentShader` disposes the whole mount (textures, program, canvas removed —
  `shader-mount.ts:590–630`) and builds a new canvas + WebGL2 context. **No built-in
  cross-fade.** Two options:
  1. **Stack-and-fade (recommended for type switches):** mount incoming shader on top at
     `opacity: 0`, fade via CSS/Framer Motion (~400–700 ms), unmount outgoing on
     transition end. Cost: two live contexts/rAF loops during the overlap only — keep the
     overlap short; this is fine as a transient state even on mobile.
  2. **Snap switch:** conditional render, accept the cut. Free, but visually abrupt.
- **Context loss:** no `webglcontextlost/restored` handling in the library. Long-lived
  single backdrop + occasional second canvas during fades keeps context count low, which
  is the practical mitigation. iOS Safari kills contexts under memory pressure —
  an error boundary + remount-on-visibility is a cheap belt-and-braces.

## 5. `speed=0`, pausing, `prefers-reduced-motion`

- `setSpeed(0)` **cancels the rAF loop entirely** (`shader-mount.ts:520–540`) — a paused
  shader has zero recurring CPU/GPU cost; the last frame stays on the canvas.
- The library auto-pauses on `document.visibilitychange` (hidden tab → speed 0, restores
  on return) — free battery win.
- `frame` prop: milliseconds of animation time; with `speed={0}` it renders one
  deterministic frame (`setFrame`, `shader-mount.ts:509–514`) — use it to pick a
  good-looking static composition for reduced motion.
- **`prefers-reduced-motion` is NOT handled by the library** (no `matchMedia` anywhere in
  source). App-side:

  ```tsx
  const reduced = useSyncExternalStore(subscribeToMotionQuery, getMotionSnapshot, () => false);
  <MeshGradient speed={reduced ? 0 : speed} frame={reduced ? 41000 : undefined} ... />
  ```

## 6. Pinning strategy

- README (repo + npm): *“Please pin your dependency – we will ship breaking changes under
  0.0.x versioning.”* Confirmed by CHANGELOG: prop renames (`straight` → `grid` in
  v0.0.65), params made required (v0.0.55), visual/preset changes (v0.0.54, v0.0.62),
  behavior changes (image upscaling, v0.0.71).
- **Use an exact pin: `"@paper-design/shaders-react": "0.0.77"`** (no `^`/`~`). Upgrades
  are deliberate events: read the CHANGELOG, eyeball the backdrop, bump the pin.
- Release cadence is ~1–3/week, so `^0.0.x` would drift constantly. License is Apache-2.0
  as of 0.0.77.

## 7. Recommended pattern: one steerable full-screen backdrop

One client component owns a single mounted shader; steering happens through uniforms;
shader-type changes are rare and cross-faded; accessibility and mobile cost are handled
at this seam.

```tsx
'use client';

type BackdropScene =
  | { shader: 'meshGradient'; props: MeshGradientProps }
  | { shader: 'grainGradient'; props: GrainGradientProps }
  | { shader: 'metaballs'; props: MetaballsProps };
  // ImageDithering/HalftoneDots need an image uniform — same slot pattern.

function ShaderBackdrop({ scene }: { scene: BackdropScene }) {
  const reduced = usePrefersReducedMotion();
  const mobile = useIsCoarsePointer();
  const perf = { minPixelRatio: mobile ? 1 : 1.5, maxPixelCount: mobile ? 1_600_000 : 4_000_000 };

  // Slot A/B: current scene + (during a type switch) outgoing scene fading out.
  const [slots, fading] = useCrossfadeSlots(scene, { durationMs: 600 });

  return (
    <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-... to-...">
      {/* CSS gradient above = pre-hydration + WebGL-unavailable fallback */}
      <ShaderErrorBoundary fallback={null}>
        {slots.map((s) => (
          <ShaderSlot
            key={s.id}                    // key per shader TYPE → remount only on type change
            {...s.scene.props}
            {...perf}
            speed={reduced ? 0 : s.scene.props.speed}
            frame={reduced ? STILL_FRAME : undefined}
            style={{ position: 'absolute', inset: 0, opacity: s.opacity,
                     transition: 'opacity 600ms ease' }}
          />
        ))}
      </ShaderErrorBoundary>
    </div>
  );
}
```

Rules of the seam:

1. **Same-shader steering** (the common case): change props; tween numeric/color uniforms
   app-side (rAF or Framer Motion `animate`) for smooth preset morphs. Keep color-array
   length constant mid-tween.
2. **Shader-type switch** (rare): second slot mounts, opacity cross-fade, outgoing slot
   unmounts on transition end. Never keep two canvases past the fade.
3. **Reduced motion:** `speed=0` + curated `frame` per shader — static but still branded.
4. **Mobile:** `minPixelRatio=1`, `maxPixelCount≈1.6M`; prefer ImageDithering/Metaballs/
   MeshGradient; avoid HalftoneDots `type="gooey"|"soft"` and GrainGradient
   blob/sphere shapes full-screen.
5. **Fallback:** error boundary → the CSS gradient that's already painted underneath.

## Open questions

- Exact gzip cost of a single-component import — measure with bundle analyzer after
  install (only unpacked sizes are verified).
- Whether iOS Safari context loss needs active handling in practice — revisit if the
  backdrop ever blanks in the field (library has no restore path).

## Sources

- npm: `npm view @paper-design/shaders-react@0.0.77` / `@paper-design/shaders@0.0.77`
  (versions, dist-tags, unpackedSize, peerDependencies, exports, sideEffects)
- GitHub `paper-design/shaders` @ v0.0.77: `CHANGELOG.md`;
  `packages/shaders-react/src/{index.ts, shader-mount.tsx, shaders/mesh-gradient.tsx}`;
  `packages/shaders/src/shader-mount.ts`;
  `packages/shaders/src/shaders/{image-dithering, metaballs, mesh-gradient, grain-gradient, halftone-dots}.ts`
- Docs: <https://shaders.paper.design> (pinning recommendation, component API)
