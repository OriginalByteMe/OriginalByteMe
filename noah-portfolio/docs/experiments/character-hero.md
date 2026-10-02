# Full-viewport Good Vibes hero experiment

Branch: `experiment/threejs-character-hero` · Draft PR #76

## Run locally

```sh
cd noah-portfolio
npm ci
npm run dev
```

Open localhost:3000. No live AI key is needed to view the hero. Real Ask-Me generation still needs the existing environment setup in `.env.local.example`.

## The experience

The entire hero is a small 3D world, with readable identity/contact/Ask-Me content layered over it. Scroll normally through the full-height hero:

1. Meet the idle character below “Hi, I’m Noah Rijkaard”
2. He runs toward the camera: “Hi hi hi hi”
3. A lens bonk, recoil and “Ow”
4. “Hey, is there anything you’d like to know about me? I’m just gonna follow you around for a little bit.”
5. Roaming: he chases the cursor or a tapped ground destination, turns, brakes and bumps into the little sculptures

The introduction uses native page scrolling, without scroll locking. Pose progress is reversible; dialogue/audio does not replay when repeatedly crossing the same phase. Skip intro enters roaming immediately and stays skipped for that page visit. Focus the world and use arrow keys to roam, Space to say hi, or Escape to stop. Pause, Reset and reversible Portrait mode are available. Real links/forms remain clickable because the transparent canvas does not intercept pointer input.

The existing public Story, Ask-Me, listening controls and other site sections remain. The character pauses when its hero world leaves view. This is a hero-world experiment, not a character covering every later Story section.

## Personality and audio

Natural seeded blinks, a tiny bob and subtle mouth motion add idle life. Two occasional idle lines are capped per session:

- “Hey, my name is Noah. Ask me a question down here.”
- “Hi, you see me? Do you see me? Oh, hello.”

A separate three-fact cap and 25-second quiet gaps apply to playful facts while stationary in roaming mode. Facts are sourced only from the public portfolio corpus, with source paths stored alongside each line: CAD/3D printing, Proxmox/Unraid, marketplace analytics and the LLM Comparison project. No private user context is included.

Sound starts off. The explicit Sound button unlocks original quiet WebAudio meeps after a user gesture. The voice is synthesized nonverbal sound, with readable captions, not a sampled game voice or a clone. Mute, movement, pause, hidden tabs, offscreen state and teardown cancel scheduled tones. Say hi can request another greeting manually.

The face layer samples the original baked Talk clip’s complete 20-weight mouth vectors, including all face-surface correctives. It never drives the Talk target alone or overwrites shoulder corrections; stale overlays are removed without fighting mixer caching.

## Performance and fallback

- Lazy Three.js/GLB loading near the viewport
- Reduced-motion and Save-Data visitors retain a static original portrait and usable content; no Three.js/model/audio download
- 30fps render cap, DPR ≤1.5, cheap contact shadow, no extra skinned shadow pass
- Explicit texture/geometry/skeleton/context/audio disposal
- WebGL/load/context-loss fallback to the portrait
- Original repaired V5 character, all 54 unique joints, 84 morphs and 10 animation clips

`public/models/good-vibes-hero.glb` is a derived runtime copy: 3,776,512 bytes / 172,813 triangles, down from 23,100,220 bytes / 388,427 triangles. Morph-bearing topology is unchanged. Only dense non-morph meshes were simplified with locked borders; textures use 1024px WebP and geometry uses Meshopt. The original editing files are unchanged. Reproduction tools are in `scripts/character-assets/`.

The character remains detailed enough that low-end device profiling is still needed before any production decision.

## Verification and known limits

```sh
npm run lint
npx tsc --noEmit
npm test
PLAYWRIGHT_TEST_MODE=1 OPENROUTER_API_KEY=test-key-not-used npm run build
npm run e2e -- e2e/character-hero.spec.ts e2e/profile-first-hero.spec.ts
```

The test build uses a placeholder key and does not call a live model. Unit/component coverage includes movement/collisions, full-world routes, scroll reversal and skipped phases, repeated entry, pause/reduced motion, resize progress, public-source facts, greeting caps, audio gesture gating/cancellation/cleanup, actual GLB face binding, and portrait fallback.

Browser E2E and actual visual QA were not completed in this task. Local Chromium fails at `socket() failed: Operation not permitted`; cloud browser loopback navigation returns `net::ERR_BLOCKED_BY_CLIENT`. The Vercel preview is protected and redirects to login. Authentication was stopped at the user’s request without entering an identifier or credentials. Protection remains unchanged. Tests and geometry checks do not prove the final in-browser appearance; the draft is ready for the user’s visual review.

No main merge, production deployment or security-setting change is part of this experiment.
