# Good Vibes hero experiment

Branch: `experiment/threejs-character-hero`. The Next.js app lives in `noah-portfolio/`.

## Try it

```sh
cd noah-portfolio
npm ci
npm run dev
```

Visit localhost:3000. The character playground progressively replaces the portrait, keeping the existing identity, contact links, Ask-Me, Story, themes and listening controls. On the stage, move the mouse or tap the floor to guide the character. Focus the stage and use arrow keys for keyboard movement, Space to wave, Escape to stop. Pause, Reset and Portrait controls remain outside the canvas. Portrait mode is reversible.

Scrolling while the pointer is outside the playground guides the character across its little stage and subtly changes the camera. Scroll gestures on touch remain native. The character does not chase across page text or obscure the real pointer.

## Implementation

- Three.js and GLTFLoader are dynamically imported only near the viewport. No GLB or Three.js download for reduced-motion or Save-Data visitors; original portrait stays intact.
- Original repaired V5 character, 54 joints, all 84 facial/shoulder morph targets and all ten animation clips. Idle/Walk/Run/Wave blend through AnimationMixer; root travel stays separate from the in-place clips.
- Pure movement controller: acceleration, braking, shortest-angle turns, fixed substeps, bounded frame delta, circle collision resolution and one bump before wall-aware routing around a prop.
- Pointer ray casts to the ground plane. Touch taps set a destination; vertical dragging still scrolls. Keyboard movement is optional and leaves the rest of the page alone.
- Render cap: 30fps, DPR ≤1.5, no dynamic shadow pass. Offscreen/hidden/paused scenes stop rendering. Meshes, textures, skeleton and WebGL context are disposed on teardown. Failed loading/WebGL creation/context loss restores the original portrait.
- Three compact sculptures have collision footprints and a small wobble response. This is lightweight character steering, not a general physics/navigation engine.

## Asset budget

`public/models/good-vibes-hero.glb` is a derived runtime copy; original editing files are unchanged. Source V5: 23,100,220 bytes / 388,427 triangles. Runtime copy: 3,776,512 bytes / 172,813 triangles. All morph-bearing topology is unchanged. Dense non-morph meshes only were simplified with locked borders; textures reduced to 1024px WebP; Meshopt compression is decoded by the bundled Three.js decoder. No external asset host or decoder CDN.

This is still a relatively detailed character. Low-end phones should be profiled before a production decision. Use the portrait toggle or reduced-motion/data-saving fallback where appropriate.

## Checks

```sh
npm run lint
npx tsc --noEmit
npm test
PLAYWRIGHT_TEST_MODE=1 OPENROUTER_API_KEY=test-key-not-used npm run build
npm run e2e -- e2e/character-hero.spec.ts e2e/profile-first-hero.spec.ts
```

The test-mode build key is a placeholder and does not call a live model. Existing generation E2E fixtures intercept requests. Real Ask-Me generation requires the existing environment setup documented in `.env.local.example`.

Movement tests include convergence, 30/60/120fps agreement, pause-like zero deltas, speed limits, arrival, overlapping spawns, prop contact/cooldown, frame spikes, world boundaries and near-wall obstacle routing. Component tests cover progressive loading, reduced motion, loading failure, pause/resume, keyboard/wave/reset, portrait/remount, changed motion preference and late asset completion.

Local browser execution in this cloud task is restricted: Chromium fails at `socket() failed: Operation not permitted`; the cloud browser blocks loopback navigation. Unit/model/build results are not a substitute for in-browser visual QA. Hosted preview testing is recorded separately when available. No merge or production deployment is part of this experiment.
