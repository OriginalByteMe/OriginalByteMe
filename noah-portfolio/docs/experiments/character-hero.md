# Good Vibes character world experiment

Branch: `experiment/character-world`, stacked on draft PR #76 (`experiment/threejs-character-hero`).

## Run locally

```sh
cd noah-portfolio
npm ci
npm run dev
```

Open localhost:3000. No live AI key is needed to view the world. Real Ask-Me generation still needs the existing environment setup in `.env.local.example`.

## The experience

The top of the home page is a small 3D world of three floating pastel dioramas, stacked 18 units apart, behind one sticky full-screen viewport. The hero, lab and about sections scroll over it as DOM panels on the left (stacked on narrow screens) while the camera eases from room to room on the right. The existing Story sections (`#story`, PortfolioCanvas) follow unchanged.

1. **Bedroom (`#hero`).** The timed intro still plays when the page opens at the top: black title, run to the lens, bonk, "Ow", recover. Then he lives in a mini bedroom with a corner desk and MacBook, a 3D printer, a server rack, a ball on a toy basket and a bed. Without commands he cycles those stations: sits at the desk and types, leans in to watch the printer, pokes the rack, tosses and catches the ball, sits on the bed and reads.
2. **Tech lab (`#lab`).** One exhibit per corpus project plus a skills wall. The DOM panel lists every project (title, description, tech, link) and every skill group. Each project's "Show me" button sends him to its exhibit, where he plays with it.
3. **About me (`#about`).** The panel shows the headline, location, career, fun facts and the hero portrait. In the room the same portrait hangs on the wall; he admires it ("Huh. Maybe that's what I'd look like.") and straightens the frame, and also visits a Kuala Lumpur skyline model and a career shelf.

Scrolling never scrubs the character. When the viewed room changes and holds for a moment, he runs to the room's open front edge ("Hey, wait for me!"), trips, tumbles down onto a landing object in the next room ("Ow"), hops down and says an arrival line. Scrolling back up makes him jump back up a room. He moves one room at a time and follows on if you scrolled further. Opening the page mid-way (for example `/#about`) skips the intro and puts him straight in the viewed room.

Input: click or tap the floor to walk there; click a station's object to send him to it; click his afro and he stops, covers it and says "Stop, don't do that." (further pokes escalate). The afro wins over the floor behind it. Panels, links and buttons never become scene clicks, and clicks are ignored while he is mid-transition. Focus the world for arrow keys, Space to say hi and Escape to stop. Pause, Reset and the reversible Portrait mode remain.

## Speech and sound

All lines come from `lib/character/narrative.ts` and only state public facts from `content/about-me/`: a line when a station routine starts (rotated and spaced out unless you asked for that station), room arrival lines, idle tidbits from the current room's pool, the afro and portrait lines. Captions show in the speech bubble; the mouth flaps for the babble's length.

Everything audible is synthesized with WebAudio in `lib/character/audio.ts`: an Animal Crossing style babble voice (greeting, fact, annoyed, wonder and bonk kinds), sound effects (footsteps in step with the walk and run clips, ball pickup/toss/catch, typing, printer and rack beeps, skill-key pokes, sparkles at the portrait and exhibits, bumps, trip, fall, land and jump) and an original chiptune loop. Sound (voice and effects) and Music are separate buttons, both off until clicked. Pausing, hiding the tab or scrolling the world offscreen suspends audio.

## How it is built

| Piece | Where |
|---|---|
| Page wiring | `app/page.tsx` passes `worldContent(corpus)` through `SiteShell` to `components/character/CharacterWorld.tsx` (sticky viewport, `#hero`, `#lab`, `#about`) |
| Scene orchestration | `components/character/create-character-scene.ts`: one renderer, one model, three areas, scroll camera, tour poses, input priority, speech and sound |
| Rooms | `components/character/world/{bedroom,lab,about}.ts`, contract in `world/types.ts` |
| Domain logic | `lib/character/{tour,activities,narrative,controller,intro,idle}.ts` |
| Contact poses | `lib/character/activity-props.ts`: ball and book on the bedroom's rest spots, IK for typing, poking, playing, admiring and guarding the afro |
| Afro hit test | `rayHitsSphere` in `lib/character/input.ts`, a sphere on the head bone sized from the model |

Seats: the held `08_Sit_Relaxed` frame sits on the floor, so seated stations lift him by the station's seat height (measured: the pelvis ends 0.15 above his feet and the seat contact about 0.13 below that). Bumping into furniture always plays a bonk, but the apology line is rate limited. Multi-circle furniture against a wall is routed round its open end (`chooseSide` in `controller.ts` scores arcs through neighbouring circles as closed).

## Performance and fallback

- Lazy Three.js/GLB loading near the viewport
- Reduced-motion and Save-Data visitors, WebGL or load failure and Portrait mode keep the static original portrait in the hero; the lab and about panels stay fully readable plain DOM without "Show me" buttons; no Three.js, model or audio download for reduced motion and Save-Data
- One WebGL renderer for all rooms, 30fps render cap, DPR ≤1.5, transparent clear over a CSS gradient, cheap contact shadow, no shadow maps; rooms two floors from the camera are not drawn
- Explicit disposal of rooms, textures, geometry, skeleton, context and audio

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

`lib/character/__tests__/scene-integration.test.ts` loads the real compressed GLB and the three real rooms and runs the real scene, mixer, tour, activities, face and props with only WebGL drawing, embedded image decoding and 2D canvas mocked. It covers: all three rooms built and every room geometry disposed; pause, hidden tab and offscreen freezing time; a floor click moving him while UI and panel clicks do not; an afro click answering "Stop, don't do that." without moving him; a station click starting that station's routine; a scroll to the lab running chase, trip, fall, land, recover with a mid-flight click ignored, a queued Show me taken on arrival, and a jump back up; starting mid-page in the viewed room; and the ball and bed routines. `lib/character/__tests__/hero-world.test.ts` walks the real controller between every pair of stations in every room.

Not verified when this was written: the camera framing, panel layout, poses, seat heights and tour choreography have not been looked at in a real browser; the e2e scenarios were updated but not run; the sound mix was rendered offline by the audio work, not listened to on the page. The coordinator's browser pass and Noah's visual and sound review are still needed. No main merge, production deployment or security-setting change is part of this experiment.
