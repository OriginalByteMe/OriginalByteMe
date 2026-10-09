# Good Vibes character world experiment

Branch: `OriginalByteMe/character-islands`, stacked on draft PR #76 (`experiment/threejs-character-hero`). It keeps #76's three islands and brings in the motion, intro, Ask bar, sky, presentations and room pieces from the town experiment (`experiment/character-town`, draft PR #78), without the town street.

## Run locally

```sh
cd noah-portfolio
npm ci
npm run dev
```

Open localhost:3000. No live AI key is needed to view the world. Real Ask-Me generation still needs the existing environment setup in `.env.local.example`.

## The experience

The top of the home page is a small 3D world of three floating dioramas, stacked 18 units apart, behind one sticky full-screen viewport. The renderer clears transparent, so the page's dithered Backdrop is the sky; a soundtrack pick retints it with the album palette. The hero, lab and about sections scroll over it as DOM panels on the left (stacked on narrow screens) while the camera eases from room to room on the right. The existing Story sections (`#story`, PortfolioCanvas) follow unchanged. One always-open Ask bar is pinned to the bottom of the viewport in every mode; it replaces the hero Ask launcher, the floating AskDock and ChatBox.

1. **Bedroom (`#hero`).** The page opens on the black "Hi, I'm Noah Rijkaard." title card from the first paint and holds it while Three.js and the model load, so the portrait never flashes first. Once the model is ready the card shows "Click to enter" and waits; a click anywhere on it starts the intro together with sound and music. The card fades onto a close, dead-on shot of his house: he runs at the camera from the stoop behind his back door, through the door, getting bigger, and bonks the lens at full speed ("Hi hi hi hi", bonk, "Ow"). He falls back, gets up with a wave, then turns to the camera and points down at the Ask bar ("If you want to know anything I'm not telling you, ask me anything down here!") while an "Ask me anything!" arrow shows over the bar, until the visitor's first click, key, wheel or touch or 7 seconds. While he recovers and points, the camera pulls straight back along its own axis to the bedroom framing. The hero copy and scroll hint wait out the run, bonk and recoil. The house has a corner desk and MacBook, a 3D printer, a server rack, a ball on a toy basket, a bed, a kitchenette, a bookcase, fairy lights and the back door. Without commands he cycles those stations: sits at the desk and types, leans in to watch the printer, pokes the rack, tosses and catches the ball, sits on the bed and reads.
2. **Tech lab (`#lab`).** One bay per corpus project along the back wall: a floating picture card over a small machine that acts out what the project does. Then one pegboard of skill icons per skill group, with that group's machine on a bench, and the TECH LAB neon over the beanbag he lands on. The DOM panel lists every project (title, description, tech, Visit link) and every skill group with each skill's name beside its vendored icon; each project and each skill group has a "Show me" button that sends him to its bay to present it.
3. **About me (`#about`).** A colourful Peranakan gallery: the portrait on the wall (he admires it, "Huh. Maybe that's what I'd look like."), the Kuala Lumpur skyline model, and a walkable career runner with a signpost and logo card per job, oldest to newest. A couch is his landing spot. The panel shows the headline, location, career, fun facts and the hero portrait.

Presentations: a station with `present` (every project bay, every skill pegboard, every career stop and the skyline) makes him present it when the visitor sends him there, by Show me or by clicking it. He faces the camera and says its lines in order while the room gets `{ stationId, progress }` for the whole presentation, and if it has a url a real "Visit" link (new tab) stands at his feet, kept on screen and clear of the panels, controls and Ask bar. A floor click, another station, a scroll that starts a trip, an afro poke, Escape or Reset ends it and takes the sign down. When he wanders to a station on his own he just plays with it.

Scrolling never scrubs the character. When the viewed room changes and holds for a moment, he runs to the room's open front edge ("Hey, wait for me!") at a run whose feet keep pace with the floor, trips when he gets there, tumbles down onto a landing object in the next room ("Ow"), hops down and says an arrival line. Scrolling back up makes him jump back up a room. He moves one room at a time and follows on if you scrolled further. Opening the page mid-way (for example `/#about`) skips the intro and puts him straight in the viewed room, held still behind "Click to enter" like every load; pictures, icons and logos that finish loading meanwhile are drawn into that still frame.

Input: click or tap the floor to walk there; click a station's object to send him to it; click his afro and he stops, covers it and says "Stop, don't do that." (further pokes escalate, and the lines start over once he has cooled off). The afro wins over the floor behind it. Panels, links and buttons never become scene clicks, and clicks are ignored while he is mid-transition. Focus the world for arrow keys, Space to say hi and Escape to stop. Pause, Reset and the reversible Portrait mode remain.

Face: `lib/character/face.ts` blends named expressions over the mixer's face, with talk flaps and blinks on top. Each afro poke is one anger level (up to four): brows pulled down, narrowed eyes and a frown, a head shake at the first two levels, then a stomp, a red face and steam. He cools off after 10 quiet seconds. He looks surprised when he bonks, trips or falls, focused while working at a station, laughs when he catches the ball, winks on Say hi, and gets drowsy and yawns after 45 seconds without input. The angry brows, narrowed lids and deep frown are extrapolated from the model's own BrowRaise, BrowSad, Blink and Frown targets; laugh and wink sample 04_Laugh and 09_Wink with their corrective weights. While he talks he faces the camera: his whole body when standing free or presenting, his head and neck (clamped to about 85°) at a station or seated.

## Speech and sound

All lines come from `lib/character/narrative.ts` or the rooms' presentation lines and only state public facts from `content/about-me/`: a line when a station routine starts (rotated and spaced out unless you asked for that station), presentation lines, room arrival lines, idle tidbits from the current room's pool, the afro and portrait lines. Captions show in the speech bubble; the mouth flaps for the babble's length.

Everything audible is synthesized with WebAudio in `lib/character/audio.ts`: an Animal Crossing style babble voice (greeting, fact, annoyed, wonder and bonk kinds), sound effects (footsteps in step with the walk and run clips, ball pickup/toss/catch, typing, printer and rack beeps, pokes, sparkles at the portrait and exhibits, bumps, trip, fall, land and jump) and an original chiptune loop. Sound (voice and effects) and Music are separate buttons, both on by default. Browsers refuse audio before a gesture, so the title card's "Click to enter" is that gesture: the intro and both start on it, and a toggle shows off if the browser still refuses. Coming back from Portrait mode shows the card again. Pausing, hiding the tab or scrolling the world offscreen suspends audio.

## How it is built

| Piece | Where |
|---|---|
| Page wiring | `app/page.tsx` passes `worldContent(corpus)` through `SiteShell` to `components/character/CharacterWorld.tsx` (sticky viewport, `#hero`, `#lab`, `#about`); `components/AskBar.tsx` is the one Ask entry point, and `AskMeProvider` carries `askPromoted` for its arrow |
| Content | `lib/character/world-content.ts`: projects with images and tech icons, skill groups with icons, career with highlights, logos and links, fun facts, plain JSON. Icons are vendored into `public/icons/` by `scripts/vendor-icons.mjs`, so WebGL only loads same-origin images; an unvendored icon fails the build |
| Scene orchestration | `components/character/create-character-scene.ts`: one renderer, one model, three areas, scroll camera, tour poses, the intro, presentations and the Visit sign, input priority, speech and sound |
| Rooms | `components/character/world/{bedroom,lab,about}.ts`, contract in `world/types.ts` |
| Domain logic | `lib/character/{tour,activities,narrative,controller,intro,idle}.ts` |
| Contact poses | `lib/character/activity-props.ts`: ball and book on the bedroom's rest spots, IK for typing, poking, playing, admiring, pointing and guarding the afro |
| Afro hit test | `rayHitsSphere` in `lib/character/input.ts`, a sphere on the head bone sized from the model |
| Sky | `components/Backdrop.tsx`, the dither shader behind the transparent canvas |

### Building a room

A room's builder is an `AreaBuilder`: `(origin, content, onImage?) => WorldArea`. The contract:

- Floor at y = 0, back wall toward -z, the open front at `bounds.maxZ`, seen from camera direction (0, .42, 1). Stay inside x in [-9, 9], y in [-3, 8], z in [-6.5, 6] around the origin. The camera fits each room by projecting the corners of its measured `Box3` into the free screen region, so everything in the group counts toward the framing.
- `bounds` is the walkable floor; `obstacles` are circles; every station `stand`, the `exit` and the hop off the `landing` sit inside `bounds` inset by 0.22 and clear of obstacles. `exit` is where he trips before falling to the next room; `landing` is the top surface he lands on arriving from another room.
- `pick` returns a station id for a ray that hits that station's object and null for floor and walls. `update(dt, elapsed, { stationId, progress })` animates the room; `stationId` is the station he is performing at or presenting.
- Give a station `present: { lines, url, linkLabel }` to have him present it with a Visit sign.
- The bedroom's back door is an `Object3D` named `back-door` (its hinge); the intro runs him from 1.2 behind it, along x = `view.center.x`, so that line stays clear to the front, with a stoop at floor height behind the door.
- Call `onImage` after applying any picture, icon or logo the room loads, so the scene can draw it while paused.
- `dispose` frees every geometry, material and texture the builder created. No lights, no DOM, no audio.

Seats: the held `08_Sit_Relaxed` frame sits on the floor. He lowers onto a seat: the scene lifts him only by as much as the sit clip drops his hips below the seat height plus 0.13 (the seat contact sits that far below the pelvis bone), so his feet stay down until his hips reach it. Build seats at about 0.3 to 0.35, below his 0.59 hip. Bumping into furniture always plays a bonk, but the apology line is rate limited. Multi-circle furniture against a wall is routed round its open end (`chooseSide` in `controller.ts` scores arcs through neighbouring circles as closed).

### Motion

- The walk and run clips play at time scale = ground speed / the clip's own speed (`CLIP_SPEED` in `controller.ts`: walk 0.376, run 0.914 m/s, measured from the GLB and pinned by a test), so a planted foot keeps pace with the floor. He walks at 0.6 m/s and runs at 2.15 m/s, including the chase to a room's front edge, which ends when he gets there rather than on a timer.
- Clip weights ease every frame and always sum to one; walk and run join each other at the same point in the stride, with hysteresis between them.
- He turns toward where he is going before he speeds up, so he never runs sideways or backwards; he turns to face a station at up to 4 rad/s and its routine starts only once he faces it; he turns his whole body to the camera to talk at an eased, steady pace.
- A bump keeps the walk or run clip and eases a small dip and roll in and out. His idle bob eases in and out as he stops and starts.
- Arms: IK solves the arm onto its target, then blends that solution in from the arm's current pose joint by joint by the pose weight, so weight 0 is the clip exactly and a light pose moves every joint only a little. The afro guard puts both hands on the afro's sides with bent elbows for 2 s, raised and lowered over 0.8 s. Hands reach for and let go of the ball and book over 0.5 s, once he faces the station. A posed arm drives that side's shirt `ShoulderVolume_*` correctives from its elevation, and they go back to the mixer's values before it runs.
- The scene renders at the display rate up to 60 fps, with 2 ms of slack so frames stay evenly spaced on 60 and 120 Hz displays.

## Performance and fallback

- Lazy Three.js/GLB loading near the viewport
- Reduced-motion and Save-Data visitors, WebGL or load failure and Portrait mode keep the static original portrait in the hero; the lab and about panels stay fully readable plain DOM without "Show me" buttons; no Three.js, model or audio download for reduced motion and Save-Data
- One WebGL renderer for all rooms, rendering at up to 60 fps, DPR ≤1.5, transparent clear so the dithered Backdrop is the sky, cheap contact shadow, no shadow maps; rooms two floors from the camera are not drawn
- Explicit disposal of rooms, textures, geometry, skeleton, context and audio

`public/models/good-vibes-hero.glb` is a derived runtime copy: 3,619,256 bytes / 172,813 triangles, down from 23,100,220 bytes / 388,427 triangles. Morph-bearing topology is unchanged. Only dense non-morph meshes were simplified with locked borders; textures use 1024px WebP and geometry uses Meshopt. The afro and beard use a solid colour instead of the atlas, because mipmapping bled the neighbouring shirt and skin islands into orange seams. The original editing files are unchanged. Reproduction tools are in `scripts/character-assets/`.

The character remains detailed enough that low-end device profiling is still needed before any production decision.

## Verification and known limits

```sh
npm run lint
npx tsc --noEmit
npm test
PLAYWRIGHT_TEST_MODE=1 OPENROUTER_API_KEY=test-key-not-used npm run build
npm run e2e -- e2e/character-hero.spec.ts e2e/profile-first-hero.spec.ts e2e/ask-me.spec.ts
```

`lib/character/__tests__/scene-integration.test.ts` loads the real compressed GLB and the three real rooms and runs the real scene, mixer, tour, activities, face and props with only WebGL drawing, embedded image decoding and 2D canvas mocked. It covers: all three rooms built and every room geometry disposed; pause, hidden tab and offscreen freezing time; a floor click moving him while UI and panel clicks do not; an afro click answering "Stop, don't do that." without moving him; a station click starting that station's routine; a scroll to the lab running him to the exit, trip, fall, land, recover with a mid-flight click ignored, a queued Show me taken on arrival, and a jump back up; a project presentation with its lines, the Visit sign and its end on a floor click, Escape or scroll; starting mid-page in the viewed room; the ball and bed routines; the clip speeds, crossfades, bump, bob, turns, afro guard, reach and seat lift; the intro's dead-on run through the back door, the dolly back without a cut, and the point that promotes the Ask bar once per intro (never when skipped, again when a remount replays it). `lib/character/__tests__/hero-world.test.ts` walks the real controller between every pair of stations in every room.

Walk and run speeds, the 60 fps choice, the shoulder correctives and the sound mix are feel calls for Noah on a real GPU (he chose to keep the lab in one row, the intro run length and the outward door swing); the screenshot pass ran under SwiftShader at about 1.5 fps, which shows framing and state but not motion. The e2e scenarios were updated but not run on this laptop. No main merge, production deployment or security-setting change is part of this experiment.
