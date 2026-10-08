# Good Vibes character world experiment

Branch: `experiment/character-town`, stacked on draft PR #76 (`experiment/threejs-character-hero`).

## Run locally

```sh
cd noah-portfolio
npm ci
npm run dev
```

Open localhost:3000. No live AI key is needed to view the world. Real Ask-Me generation still needs the existing environment setup in `.env.local.example`.

## The experience

The home page is one tiny 3D town behind a sticky full-screen viewport: seven buildings on one street along +x, one per Story chapter, with the page's dithered Backdrop showing through as the sky. The camera looks dead-on down -z with a gentle downward tilt and frames the current building in the free part of the screen (clear of the top chrome, the controls and the Ask bar; on the home lot also clear of the hero copy). Scrolling eases it along the street.

| Lot | Section | Chapter | Building now |
|---|---|---|---|
| `home` | `#hero` | Hero copy and contacts | Noah's bedroom: corner desk and MacBook, 3D printer, server rack, ball on a toy basket, bed |
| `hall` | `#brief` | Noah, in brief | Placeholder shell |
| `workshop` | `#built` | Things I've built | The tech lab: one exhibit per corpus project and a skills keyboard wall |
| `toolshed` | `#toolbox` | The toolbox | Placeholder shell |
| `gallery` | `#about` | About me and where I've been | The about room: framed portrait, Kuala Lumpur skyline, career shelf |
| `garage` | `#rig` | The rig | Placeholder shell |
| `postoffice` | `#say-hi` | Say hi | Placeholder shell |

The page opens on the black "Hi, I'm Noah Rijkaard." title card from the first paint and holds it while Three.js and the model load. Once the model is ready the card shows "Click to enter"; a click starts the timed intro (run to the lens, bonk, "Ow", recover) together with sound and music. Without commands he cycles the stations of the lot he is in: at home he types at the desk, watches the printer, pokes the rack, tosses the ball and reads on the bed.

Each lot's section carries that chapter's facts as screen-reader text, with no visible side panels; a keyboard user tabbing to one of its links sees the facts as a panel. While the world is loading or live, the home-mode 2D Story (`#story`) is hidden with CSS (`:has()` on the world's `data-status`). Reduced motion, Save-Data, WebGL failure and Portrait mode keep the original portrait in the hero and show the 2D Story chapters as before. Ask-Me answers still take over the page with the 2D Story.

Scrolling never scrubs the character. When the viewed lot changes and holds for a moment, he runs along the street to it ("Hey, wait for me!"), out of the building he is in, past any lots in between, and in to the new lot's entry, then says that lot's arrival line. If the view changes again mid-walk he turns toward the new lot from wherever he has got to. Opening the page mid-way (for example `/#about`) skips the intro and puts him straight at the viewed lot.

Input: click or tap the floor to walk there; click a station's object to send him to it; click his afro and he stops, covers it and says "Stop, don't do that." (further pokes escalate, and the lines start over once he has cooled off). The afro wins over the floor behind it. Links and buttons never become scene clicks, and clicks are ignored while he walks between lots. Focus the world for arrow keys, Space to say hi and Escape to stop. Pause, Reset and the reversible Portrait mode remain.

Presentations: a station with `present` (today every workshop exhibit) makes him present it when the visitor sends him there. He faces the camera and says its lines in order while the building gets `{ stationId, progress }` for the whole presentation, and if it has a url a real "Visit <project>" link (new tab) stands at his feet, kept on screen and clear of the controls. A floor click, another station, a scroll that starts a walk, an afro poke, Escape or Reset ends it and takes the sign down. When he wanders to an exhibit on his own he just plays with it, as before.

Face: `lib/character/face.ts` blends named expressions over the mixer's face, with talk flaps and blinks on top. Each afro poke is one anger level (up to four): brows pulled down, narrowed eyes and a frown, a head shake at the first two levels, then a stomp, a red face and steam. He cools off after 10 quiet seconds. He looks surprised when he bonks, focused while working at a station, laughs when he catches the ball, winks on Say hi, and gets drowsy and yawns after 45 seconds without input. While he talks he faces the camera: his whole body when standing free or presenting, his head and neck (clamped to about 85°) at a station or seated.

## Speech and sound

All lines come from `lib/character/narrative.ts` and only state public facts from `content/about-me/`: a line when a station routine starts (rotated and spaced out unless you asked for that station), presentation lines, one arrival line per lot, idle tidbits from the current lot's pool (lots without a pool stay quiet), the afro and portrait lines. Captions show in the speech bubble; the mouth flaps for the babble's length.

Everything audible is synthesized with WebAudio in `lib/character/audio.ts`: an Animal Crossing style babble voice (greeting, fact, annoyed, wonder and bonk kinds), sound effects (footsteps in step with the walk and run clips, ball pickup/toss/catch, typing, printer and rack beeps, skill-key pokes, sparkles at the portrait and exhibits, bumps and the stomp) and an original chiptune loop. Sound (voice and effects) and Music are separate buttons, both on by default. Browsers refuse audio before a gesture, so the title card's "Click to enter" is that gesture: the intro and both start on it, and a toggle shows off if the browser still refuses. Coming back from Portrait mode shows the card again. Pausing, hiding the tab or scrolling the world offscreen suspends audio.

## How it is built

| Piece | Where |
|---|---|
| Page wiring | `app/page.tsx` passes `worldContent(corpus)` through `SiteShell` to `components/character/CharacterWorld.tsx` (sticky viewport and one section per lot) |
| Content | `lib/character/world-content.ts`: every chapter's facts (bio summary, the Chapter 01 beat and stat, projects with images and tech icons, skills with icon URLs, career with highlights, logos and links, fun facts, operating systems, side projects, contact), plain JSON |
| Scene orchestration | `components/character/create-character-scene.ts`: one renderer, one model, seven lots and the street, scroll camera, the walk between lots, presentations and the Visit sign, input priority, speech and sound |
| Street and lots | `components/character/world/types.ts` (`LOTS`, `WorldArea`, `Station`, `AreaBuilder`), `world/town.ts` (lot origins 16 apart, the street and ground, the placeholder shell) |
| Buildings | `world/{bedroom,lab,about}.ts` (home, workshop, gallery for now) and the shells `world/{hall,toolshed,garage,postoffice}.ts` |
| Domain logic | `lib/character/{tour,activities,narrative,controller,intro,idle}.ts` |
| Contact poses | `lib/character/activity-props.ts`: ball and book on the home rest spots, IK for typing, poking, playing, admiring and guarding the afro |
| Afro hit test | `rayHitsSphere` in `lib/character/input.ts`, a sphere on the head bone sized from the model |

### Building a lot

A lot's builder is an `AreaBuilder`: `(origin, content) => WorldArea`. Replace the shell's one-line builder file with your own and keep its export name; the scene picks builders by lot id. The contract:

- Build at `origin` (lot `i` is at `(16 * i, 0, 0)`) and stay inside x in [-7, 7], y in [-3, 7], z in [-4.5, 4.5] around it. Floor at y = 0, back wall toward -z, the open front toward +z and the street (centre line at world z 5.7).
- `bounds` is the walkable floor; `obstacles` are circles; every station `stand` and the `entry` sit inside `bounds` inset by 0.22 and clear of obstacles. `entry` is where he stops after walking in from the street; keep it out from in front of your stations so his afro does not cover them.
- `pick` returns a station id for a ray that hits that station's object and null for floor and walls. `update(dt, elapsed, { stationId, progress })` animates the building; `stationId` is the station he is performing at or presenting.
- Give a station `present: { lines, url, linkLabel }` to have him present it with a Visit sign.
- `dispose` frees every geometry, material and texture the builder created. No lights, no DOM, no audio.

Seats: the held `08_Sit_Relaxed` frame sits on the floor, so seated stations lift him by the station's seat height (measured: the pelvis ends 0.15 above his feet and the seat contact about 0.13 below that). Bumping into furniture always plays a bonk, but the apology line is rate limited. Multi-circle furniture against a wall is routed round its open end (`chooseSide` in `controller.ts` scores arcs through neighbouring circles as closed).

## Performance and fallback

- Lazy Three.js/GLB loading near the viewport
- Reduced-motion and Save-Data visitors, WebGL or load failure and Portrait mode keep the static original portrait in the hero and the 2D Story chapters; no Three.js, model or audio download for reduced motion and Save-Data
- One WebGL renderer for all lots, 30fps render cap, DPR ≤1.5, transparent clear so the dithered Backdrop is the sky, cheap contact shadow, no shadow maps; lots more than about one and a half lots from the camera are not drawn
- Explicit disposal of lots, the street, textures, geometry, skeleton, context and audio

`public/models/good-vibes-hero.glb` is a derived runtime copy: 3,619,256 bytes / 172,813 triangles, down from 23,100,220 bytes / 388,427 triangles. Morph-bearing topology is unchanged. Only dense non-morph meshes were simplified with locked borders; textures use 1024px WebP and geometry uses Meshopt. The afro and beard use a solid colour instead of the atlas, because mipmapping bled the neighbouring shirt and skin islands into orange seams. The original editing files are unchanged. Reproduction tools are in `scripts/character-assets/`.

The character remains detailed enough that low-end device profiling is still needed before any production decision.

## Verification and known limits

```sh
npm run lint
npx tsc --noEmit
npm test
PLAYWRIGHT_TEST_MODE=1 OPENROUTER_API_KEY=test-key-not-used npm run build
npm run e2e -- e2e/character-hero.spec.ts e2e/profile-first-hero.spec.ts
```

`lib/character/__tests__/scene-integration.test.ts` loads the real compressed GLB and the seven real lots and runs the real scene, mixer, tour, activities, face and props with only WebGL drawing, embedded image decoding and 2D canvas mocked. It covers: all seven lots built along the street and every geometry disposed; pause, hidden tab and offscreen freezing time; a floor click moving him while UI and panel clicks do not; an afro click answering "Stop, don't do that." without moving him; a station click starting that station's routine; a scroll to the workshop walking him along the street past the hall with a mid-walk click ignored, and back home; a fast scroll running him past several lots in one trip; a project presentation with its line and Visit sign, ended by a floor click and by a scroll; starting at a deep-linked lot; and the ball and bed routines. `lib/character/__tests__/hero-world.test.ts` walks the real controller from every lot's entry to every station and between every pair of stations.

The walk along the street is fast on purpose (a one-lot trip takes 2.5 s, the longest 5 s), so the run clip plays faster than its stride and his feet slide on long trips; CW-9 owns the walk and arm smoothing. The placeholder shells and the old home, workshop and gallery rooms are replaced by their own tickets. The e2e scenarios were updated but not run on this laptop. Noah's visual and sound review on the preview is still needed. No main merge, production deployment or security-setting change is part of this experiment.
