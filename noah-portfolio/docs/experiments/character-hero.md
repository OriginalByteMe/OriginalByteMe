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

The entire hero is a small white 3D world, with readable identity/contact/Ask-Me content layered over it. Once the actual V5 model is ready, a timed introduction plays:

1. Black opening: “Hi, I’m Noah Rijkaard”
2. Fade into the white world, then run toward the lens: “Hi hi hi hi”
3. Lens bonk/camera shake, a fall/recoil and “Ow”
4. Recover, explain click-to-move, and enter the free environment
5. Click or tap a floor destination to move there; hover never commands movement
6. Without a command, pick up/toss/catch a striped ball, then sit and read an open book

The intro takes about 12 active seconds. Page scrolling is ordinary scrolling and never drives or rewinds animation. Skip intro enters free play immediately. Focus the world and use arrow keys to move, Space to say hi, or Escape to stop. Pause, Reset and reversible Portrait mode are available. Clicks on links/forms/controls and touch-scroll gestures are ignored by movement input. A new click interrupts an activity, releases its prop, and redirects the character; props ease back to their rests.

Activities use the repaired model's arm bones for reversible hand contact and the real `08_Sit_Relaxed` clip, scrubbed into a held seated pose rather than looping stand/sit. Controller clocks freeze when hidden, paused or offscreen. Destinations inside solid props are projected to reachable surfaces so commands finish and autonomous activities can resume.

The existing public Story, Ask-Me, listening controls and other site sections remain. The character pauses when its hero world leaves view. This is a hero-world experiment, not a character covering every later Story section.

## Personality and audio

Natural seeded blinks, a tiny bob and subtle mouth motion add idle life. Two occasional idle lines are capped per session:

- “Hey, my name is Noah. Ask me a question down here.”
- “Hi, you see me? Do you see me? Oh, hello.”

A separate three-fact cap and 25-second quiet gaps apply to playful facts while stationary in roaming mode. Facts are sourced only from the public portfolio corpus, with source paths stored alongside each line: CAD/3D printing, Proxmox/Unraid, marketplace analytics and the LLM Comparison project. No private user context is included.

Sound starts off. The explicit Sound button unlocks original quiet WebAudio meeps after a user gesture. The voice is synthesized nonverbal sound, with readable captions, not a sampled game voice or a clone. Mute, a new movement command, pause, hidden tabs, offscreen state and teardown cancel scheduled tones. Say hi can request another greeting manually.

The face layer samples the original baked Talk clip’s complete 20-weight mouth vectors, including all face-surface correctives. Speech is given a clearly visible blend instead of being attenuated twice against the default grin. Natural blinks include a short closed-eye hold at the 30fps render rate, and remain enabled during movement and activities. It never drives the Talk target alone or overwrites shoulder corrections; stale overlays are removed without fighting mixer caching. Actual loaded-GLB vertex/morph regression checks complement controller tests.

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

The final revision passes 452 tests across 51 files, ESLint, TypeScript, and the optimized Next.js build. Eight integration tests load the actual compressed V5 GLB and run the actual scene/mixer/face/activity logic with only WebGL drawing and texture decoding mocked.

The test build uses a placeholder key and does not call a live model. Unit/component coverage includes movement/collisions, full-world routes, timed phase continuity, skip/repeated entry, pause/reduced motion, inherited browser pointer events, prop-center destinations, activity interruption/ownership, seated clip holding, public-source facts, greeting caps, audio gesture gating/cancellation/cleanup, actual GLB face binding, and portrait fallback.

Browser E2E and final website visual QA were not completed in this task. Offline model face renders are separate evidence, not website screenshots. Local Chromium fails at `socket() failed: Operation not permitted`; cloud browser loopback navigation returns `net::ERR_BLOCKED_BY_CLIENT`. The Vercel preview is protected and redirects to login. Authentication was stopped at the user’s request without entering an identifier or credentials. Protection remains unchanged. Tests and geometry checks do not prove the final in-browser appearance; the draft is ready for the user’s visual review.

No main merge, production deployment or security-setting change is part of this experiment.
