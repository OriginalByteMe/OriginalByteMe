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

| Lot | Section | Chapter | Building |
|---|---|---|---|
| `home` | `#hero` | Hero copy and contacts | His house: desk and MacBook, 3D printer, server rack, ball on a toy basket, bed, kitchenette, bookcase and a back door he runs in through during the intro |
| `hall` | `#brief` | Noah, in brief | A Kuala Lumpur town hall and plaza: a bust of him with the headline and bio badges, a flip board counting up the years, a globe that turns to Kuala Lumpur |
| `workshop` | `#built` | Things I've built | Floating project pictures, each with a small machine that acts out what the project does while he presents it |
| `toolshed` | `#toolbox` | The toolbox | One pegboard of skill icons per group, each group with its own machine |
| `gallery` | `#about` | About me and where I've been | A colourful Peranakan shophouse: the portrait, a walkable career runner with company logos, fun-fact pedestals, the Kuala Lumpur skyline model |
| `garage` | `#rig` | The rig | A machine per operating system that boots when presented, plus the 3D printer and blog typewriter side projects |
| `postoffice` | `#say-hi` | Say hi | A pillar box for email and stations for GitHub, LinkedIn and the blog, each with a Visit link |

The page opens on the black "Hi, I'm Noah Rijkaard." title card from the first paint and holds it while Three.js and the model load. Once the model is ready the card shows "Click to enter"; a click starts the intro together with sound and music. The card fades in half a second onto a close, dead-on shot inside his room: he runs at the camera from far back (through the back door when the home lot has one), getting bigger, and bonks the lens at full speed ("Hi hi hi hi", bonk, "Ow"). He falls back, gets up with a wave, then turns to the camera and points down at the Ask bar ("If you want to know anything I'm not telling you, ask me anything down here!") while the bar's arrow shows. While he recovers and points, the camera pulls straight back along its own axis to the home lot's roaming framing (no zoom in, no sideways slide) and he starts roaming from where he stands. The arrow goes away on the visitor's first interaction or after 7 seconds; skipping the intro skips the point too. Without commands he cycles the stations of the lot he is in: at home he types at the desk, watches the printer, pokes the rack, tosses the ball and reads on the bed.

Each lot's section carries that chapter's facts as screen-reader text, with no visible side panels; a keyboard user tabbing to one of its links sees the facts as a panel. While the world is loading or live, the home-mode 2D Story (`#story`) is hidden with CSS (`:has()` on the world's `data-status`). Reduced motion, Save-Data, WebGL failure and Portrait mode keep the original portrait in the hero and show the 2D Story chapters as before. Ask-Me answers still take over the page with the 2D Story.

Scrolling never scrubs the character. When the viewed lot changes and holds for a moment, he runs along the street to it ("Hey, wait for me!"), out of the building he is in, past any lots in between, and in to the new lot's entry, then says that lot's arrival line. He runs for real wherever the camera can see him (2.8 m/s, the run clip at the matching speed) and only dashes where he is out of shot, so a trip to a neighbouring lot takes several seconds; the trip ends when he reaches the lot, not on a timer. If the view changes again mid-walk he turns toward the new lot from wherever he has got to. Opening the page mid-way (for example `/#about`) skips the intro and puts him straight at the viewed lot.

Input: click or tap the floor to walk there; click a station's object to send him to it; click his afro and he stops, covers it and says "Stop, don't do that." (further pokes escalate, and the lines start over once he has cooled off). The afro wins over the floor behind it. Links and buttons never become scene clicks, and clicks are ignored while he walks between lots. Focus the world for arrow keys, Space to say hi and Escape to stop. Pause, Reset and the reversible Portrait mode remain.

Presentations: a station with `present` (the workshop exhibits, toolshed groups, hall displays, gallery career and facts, garage machines and post office stations) makes him present it when the visitor sends him there. He faces the camera and says its lines in order while the building gets `{ stationId, progress }` for the whole presentation, and if it has a url a real "Visit" link (new tab) stands at his feet, kept on screen and clear of the controls. A floor click, another station, a scroll that starts a walk, an afro poke, Escape or Reset ends it and takes the sign down. When he wanders to a station on his own he just plays with it, as before.

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
| Street and lots | `components/character/world/types.ts` (`LOTS`, `WorldArea`, `Station`, `AreaBuilder`), `world/town.ts` (lot origins 16 apart, the street and ground) |
| Buildings | `world/{bedroom,hall,lab,toolshed,about,garage,postoffice}.ts` for home, hall, workshop, toolshed, gallery, garage and post office. Icons are vendored into `public/icons/` by `scripts/vendor-icons.mjs` so WebGL only loads same-origin images |
| Domain logic | `lib/character/{tour,activities,narrative,controller,intro,idle}.ts` |
| Contact poses | `lib/character/activity-props.ts`: ball and book on the home rest spots, IK for typing, poking, playing, admiring and guarding the afro |
| Afro hit test | `rayHitsSphere` in `lib/character/input.ts`, a sphere on the head bone sized from the model |

### Building a lot

A lot's builder is an `AreaBuilder`: `(origin, content) => WorldArea`, one file per lot under `components/character/world/`; the scene picks builders by lot id. The contract:

- Build at `origin` (lot `i` is at `(16 * i, 0, 0)`) and stay inside x in [-7, 7], y in [-3, 7], z in [-4.5, 4.5] around it. Floor at y = 0, back wall toward -z, the open front toward +z and the street (centre line at world z 5.7).
- `bounds` is the walkable floor; `obstacles` are circles; every station `stand` and the `entry` sit inside `bounds` inset by 0.22 and clear of obstacles. `entry` is where he stops after walking in from the street; keep it out from in front of your stations so his afro does not cover them.
- `pick` returns a station id for a ray that hits that station's object and null for floor and walls. `update(dt, elapsed, { stationId, progress })` animates the building; `stationId` is the station he is performing at or presenting.
- Give a station `present: { lines, url, linkLabel }` to have him present it with a Visit sign.
- `dispose` frees every geometry, material and texture the builder created. No lights, no DOM, no audio.

Seats: the held `08_Sit_Relaxed` frame sits on the floor. He lowers onto a seat: the scene lifts him only by as much as the sit clip drops his hips below the seat height plus 0.13 (the seat contact sits that far below the pelvis bone), so his feet stay down until his hips reach it. Build seats at about 0.3 to 0.35, below his 0.59 hip; a higher seat lifts him over the first quarter of the sit instead. Bumping into furniture always plays a bonk, but the apology line is rate limited. Multi-circle furniture against a wall is routed round its open end (`chooseSide` in `controller.ts` scores arcs through neighbouring circles as closed).

### Motion

- The walk and run clips play at time scale = ground speed / the clip's own speed (`CLIP_SPEED` in `controller.ts`: walk 0.376, run 0.914 m/s, measured from the GLB and pinned by a test), so a planted foot keeps pace with the floor. He walks at 0.6 m/s (about 2.4 steps a second) and runs at 2.15 m/s.
- Clip weights ease every frame and always sum to one; walk and run join each other at the same point in the stride, with hysteresis between them (a run above walk speed + 0.15, back to a walk below walk speed - 0.1).
- He turns toward where he is going before he speeds up, so he never runs sideways or backwards; he turns to face a station at up to 4 rad/s and its routine starts only once he faces it; he turns his whole body to the camera to talk at an eased, steady pace.
- A bump keeps the walk or run clip and eases a small dip and roll in and out. His idle bob eases in and out as he stops and starts.
- Arms: IK solves the arm onto its target, then blends that solution in from the arm's current pose joint by joint by the pose weight, so weight 0 is the clip exactly and a light pose moves every joint only a little. The afro guard puts both hands on the afro's sides with bent elbows for 2 s, raised and lowered over 0.8 s. Hands reach for and let go of the ball and book over 0.5 s, once he faces the station. A posed arm drives that side's shirt `ShoulderVolume_*` correctives from its elevation, and they go back to the mixer's values before it runs.
- The scene renders at the display rate up to 60 fps, with 2 ms of slack so frames stay evenly spaced on 60 and 120 Hz displays.

## Performance and fallback

- Lazy Three.js/GLB loading near the viewport
- Reduced-motion and Save-Data visitors, WebGL or load failure and Portrait mode keep the static original portrait in the hero and the 2D Story chapters; no Three.js, model or audio download for reduced motion and Save-Data
- One WebGL renderer for all lots, rendering at up to 60 fps, DPR ≤1.5, transparent clear so the dithered Backdrop is the sky, cheap contact shadow, no shadow maps; lots more than about one and a half lots from the camera are not drawn
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

`lib/character/__tests__/scene-integration.test.ts` loads the real compressed GLB and the seven real lots and runs the real scene, mixer, tour, activities, face and props with only WebGL drawing, embedded image decoding and 2D canvas mocked. It covers: all seven lots built along the street and every geometry disposed; pause, hidden tab and offscreen freezing time; a floor click moving him while UI and panel clicks do not; an afro click answering "Stop, don't do that." without moving him; a station click starting that station's routine; a scroll to the workshop walking him along the street past the hall with a mid-walk click ignored, and back home; a fast scroll running him past several lots in one trip; a project presentation with its line and Visit sign, ended by a floor click and by a scroll; starting at a deep-linked lot; and the ball and bed routines. Its motion tests pin the walk and run clip speeds measured from the GLB and check: no foot slide in a walk, a run, the intro run and wherever the camera sees him on the street; an even render beat on 60 and 120 Hz; clip weights that sum to one without jumps; a bump that keeps the walk or run with an eased dip; an eased bob; a steady turn to the bed; the afro guard with bent elbows and unhurried hands; an unhurried book pickup and return; feet down until his hips reach a low seat; the intro's single straight pull back with no cut; and the Ask bar point promoting once, never when skipped. `lib/character/__tests__/hero-world.test.ts` walks the real controller from every lot's entry to every station and between every pair of stations.

Walk and run speeds, the street pace, the 60 fps choice and the shoulder correctives (whose 90 to 180 degree shapes had never been rendered before) are feel calls for Noah on a real GPU. The walk clip is a step-and-hold gait with a rigid torso, so even at the matched speed a foot is fully planted for only part of each step; a re-authored walk or foot-lock IK would go further. The e2e scenarios were updated but not run on this laptop. Noah's visual and sound review on the preview is still needed. No main merge, production deployment or security-setting change is part of this experiment.
