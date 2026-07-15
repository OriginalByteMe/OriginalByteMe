# Ask-Me Story Experience Design Contract — v3

> **Status:** Accepted on 2026-07-14.
>
> **Authority:** This document is the product and interaction source of truth for generated answers in the Ask-Me portfolio. It supersedes v2 in full. Git history preserves the retired Soft Field/static-answer contract; there is no second active contract or compatibility mode.
>
> **Scope:** Generated Stories, Story planning and progressive delivery, Scene Patterns, Motion and Media Assets, Nocturne visual language, Backdrop behavior, navigation, sharing, versioning, accessibility, performance, recovery, and migration from the current implementation.
>
> **Domain language:** [`CONTEXT.md`](../CONTEXT.md) is the glossary. This contract owns behavior and implementation policy; the glossary must remain free of those mechanics.
>
> **Library research:** [`research/2026-07-14-animated-svg-libraries.md`](research/2026-07-14-animated-svg-libraries.md) records the source-verified animation-library evaluation behind §9.

## 1. Product invariant

Every valid visitor question produces a scrolling **Story** about Noah. A successful answer is never a single card, a flat component dump, or a short-answer exception.

A Story:

- contains **3–5 ordered, full-height Scenes**;
- gives the direct answer in Scene 1;
- uses only the direct answer and relevant supporting facts from the **Corpus**;
- uses distinct, semantically eligible **Scene Patterns**;
- contains one focal **Motion Asset** per Scene;
- carries an **Evidence Ref** for every factual claim;
- ends with a tailored takeaway and 2–3 grounded **Related Questions**;
- is navigable by normal scrolling and the persistent **Story Rail**;
- uses one **Backdrop Preset** with bounded **Scene Cues** rather than switching shader families per Scene.

The generated-answer schema has no `static` mode. `StaticComposition` is retired. Technical failures render an explicit retry state; they never silently reintroduce a compact answer.

## 2. Answer scope and grounding

### 2.1 Noah-focused scope

Ask-Me is a portfolio, not a general-purpose assistant. It answers from Noah's Corpus and relevant Media Assets.

- A question about Noah receives a grounded Story.
- A general question may be reframed only through known facts about Noah. For example, “What is Rust?” may show Noah's verified Rust work, but must not become an unsourced encyclopedia answer.
- The model must not invent biography, preferences, motivations, anecdotes, dates, metrics, quotes, project outcomes, or relationships.
- Relevant Corpus context may broaden a narrow answer, but it must remain visibly connected to the visitor's question.

### 2.2 Boundary Stories

When the Corpus cannot ground the requested answer, generate an honest **Boundary Story** with exactly three Scenes:

1. **Boundary answer:** state immediately that the available portfolio material does not establish the requested fact.
2. **Known context:** show only genuinely related Corpus facts through `KnowledgeMap` or another eligible evidence pattern.
3. **Next paths:** offer grounded Related Questions or a relevant contact path.

A Boundary Story is not a refusal card, an inferred answer, or a technical-error fallback. It must never turn absence of evidence into a guess.

### 2.3 Evidence Refs

Every factual content unit in the Story Plan and composed Story carries one or more Evidence Refs.

- An Evidence Ref points to a stable Corpus section identifier or relevant Media Asset identifier—not a raw repository path in visitor-facing UI.
- Generation and validation use the refs internally.
- The default Story presentation remains cinematic and uncluttered.
- An optional “About this answer” disclosure exposes human-readable source titles or sections.
- Claims without valid refs fail validation and must be repaired or removed.

## 3. Story lifecycle

> Status: **Shipped.** The plan-first, progressive Story lifecycle is implemented by the current v5 Story contract.

### 3.1 Question submission

Submitting a question enters a dedicated full-page Story mode. Home content does not remain in the Story document.

- The home **Tableau** transitions out without becoming a Story Scene.
- Story mode owns its own Backdrop, Prelude, Rail, scrolling container, and history entry.
- Back navigation restores the prior home state and scroll position.
- Submitting another question while generation is active cancels the active request. The latest explicit question wins; incomplete work is neither cached nor published.

### 3.2 Plan first

Before composing Scene content, generate and validate a lightweight **Story Plan**. The Plan locks:

- grounded versus Boundary Story classification;
- the 3–5 ordered Scene roles and labels;
- the direct-answer claim;
- Evidence Refs for every planned factual beat;
- Scene Pattern and Register for each Scene;
- Motion Asset and optional relevant Media Asset;
- the Story-level Backdrop Preset;
- each Scene's bounded Backdrop Cue;
- the tailored ending and Related Questions.

The Plan is an internal orchestration artifact. Do not expose model reasoning or chain-of-thought. The Prelude may communicate real phases and Scene count, but not hidden reasoning.

### 3.3 Animated Story Prelude

Before Scene 1 is ready, show a full-height **Story Prelude** in the same Nocturne language.

It may report only real lifecycle states:

1. grounding the question;
2. planning the Story;
3. composing the opening Scene.

Do not show fake percentages, invented progress, raw prompts, or the internal Story Plan. The product target is a validated Scene 1 within **6 seconds** under normal operating conditions.

### 3.4 Progressive Scene delivery

After Plan validation:

1. compose and validate Scene 1 first;
2. replace the Prelude with Scene 1;
3. compose remaining Scenes and append them in Plan order as each becomes ready;
4. show a compact, themed composing sentinel at the document end while another Scene is pending;
5. remove the sentinel when the final Scene arrives.

Do not reserve full-height empty Scene slots. Document height grows as Scenes append. The Story Rail lists ready Scenes and one pending state; it must not expose jump targets that do not yet exist.

The complete Story target is **20 seconds** under normal operating conditions.

### 3.5 Cancellation and ordering

- A new question aborts all pending generation for the previous Story.
- Aborted or disconnected requests must stop downstream model work where the provider supports cancellation.
- A Scene may finish internally out of order, but the client appends only in Story Plan order.
- Appending content must not move focus, reset the visitor's current Scene, or force-scroll the document.

## 4. Story structure and richness contract

A structurally valid JSON tree is not necessarily an acceptable Story. The server must enforce a deterministic richness contract before publication.

Every grounded Story must satisfy all of these rules:

1. **3–5 Scenes.** No short-answer exception.
2. **Direct answer first.** Scene 1 states the answer rather than delaying it for suspense.
3. **Distinct patterns.** No Scene Pattern repeats within a Story.
4. **Semantic eligibility.** A pattern may be selected only when its required evidence shape exists.
5. **Visual diversity.** At least two of the Editorial, Dense, and Diagrammatic Registers appear.
6. **Evidence showcase.** At least one Scene uses an evidence-heavy Pattern rather than prose alone.
7. **Focal motion.** Every Scene has exactly one primary Motion Asset or animated showcase.
8. **Grounded claims.** Every factual unit resolves to valid Evidence Refs.
9. **Visual-first copy.** Each Scene communicates one primary claim in approximately 40–90 words of main narrative. Supporting detail belongs in labels, timelines, cards, diagrams, or optional disclosures.
10. **Tailored ending.** The last Scene synthesizes the answer and offers 2–3 grounded Related Questions. Contact or project links appear only when relevant.
11. **No arbitrary code.** Specs never contain raw SVG markup, generated paths, JavaScript, CSS, shader uniforms, or animation timelines.

Anything that fails this contract is repaired before reveal. Prompt guidance alone is insufficient.

## 5. Scene Pattern Catalog

> Status: **Roadmap.** The shipped v5 allowlist contains seven patterns: `hero-statement`, `project-spotlight`, `evidence-ledger`, `timeline`, `capability-map`, `system-diagram`, and `closing-synthesis`. The 17-pattern catalog below is not the current generated Spec enum.

The initial Catalog contains the following 17 Patterns. Pattern names are stable schema identifiers. Each Pattern owns responsive hierarchy, choreography, accessibility behavior, and its typed content shape.

| Pattern | Register | Eligible evidence | Purpose |
|---|---|---|---|
| `answerHero` | Editorial | Direct grounded answer or explicit boundary | Required opening form; answer, short support, focal identity asset. |
| `kineticStatement` | Editorial | One strong grounded proposition with supporting context | Large animated type and illustration for a defining idea. |
| `evidenceBento` | Dense | 3–7 related facts with refs | Hierarchical fact tiles; never a miscellaneous card dump. |
| `metricStage` | Dense | At least one verified numeric value | Animated metric with context and units; prohibited when the Corpus has no number. |
| `timelineJourney` | Dense | At least two ordered dated/period events | Career, project, or learning progression. |
| `projectSpotlight` | Editorial | One project with outcome, role, or artifact evidence | Deep focus on one relevant project. |
| `projectGallery` | Dense | At least two relevant projects | Comparative project showcase with clear relevance to the question. |
| `skillConstellation` | Dense | Categorized skills or capabilities | Relationship-oriented skill display; avoids unweighted tag clouds. |
| `stackOrbit` | Diagrammatic | Technologies with a verified workflow or relationship | Animated ecosystem/stack relationships; never implies unsupported dependencies. |
| `comparisonSplit` | Diagrammatic | Two grounded subjects with comparable attributes | Side-by-side comparison without manufactured winners. |
| `processFlow` | Diagrammatic | At least three ordered steps | Workflow, method, or build process. |
| `architectureMap` | Diagrammatic | Verified entities and relationships | System/component explanation; no invented infrastructure. |
| `codeTerminalTheater` | Dense | Verified command, code, configuration, or terminal-oriented workflow | Code/terminal showcase with readable text and a non-essential animation layer. |
| `mediaFeature` | Editorial | A relevant Media Asset with contextual metadata | Photo/video-led evidence; never inserts a generic portrait merely for decoration. |
| `quotePrincipleStage` | Editorial | A verified quote or explicitly authored principle | Personal voice or working principle; model-authored prose is not presented as Noah's quote. |
| `knowledgeMap` | Diagrammatic | Multiple related Corpus facts or an honest evidence boundary | Maps what is known and related; required as the preferred middle pattern for Boundary Stories. |
| `tailoredTakeaway` | Editorial | Synthesis of prior grounded Scenes | Closing synthesis, Related Questions, and only relevant links. |

### 5.1 Selection rules

- `answerHero` is the default opening Pattern.
- `tailoredTakeaway` is the default closing Pattern.
- Boundary Stories use `answerHero`, `knowledgeMap`, and `tailoredTakeaway`.
- `metricStage`, `timelineJourney`, `comparisonSplit`, `architectureMap`, `codeTerminalTheater`, and `mediaFeature` are ineligible without their stated evidence shape.
- Adjacent Scenes must differ in visual silhouette as well as Pattern name.
- Pattern selection is semantic and deterministic under a fixed Story Plan. Do not add weighted visual randomness.
- The broad Catalog does not waive quality: every Pattern must pass responsive, light/dark, reduced-motion, keyboard, and streaming-state QA before it enters the generated Spec enum.

## 6. Nocturne visual language

### 6.1 Identity

**Nocturne** is the core visual language for generated Stories in both light and dark modes. It combines:

- dithered and halftone texture;
- deep matte hierarchy rather than glass or blur;
- restrained violet and mint/cool-green ink;
- editorial display moments;
- crisp mono labels and evidence metadata;
- one visually dominant animated element per Scene.

Nocturne is not synonymous with dark mode. The same composition and semantic hierarchy must have coordinated light and dark counterparts selected by the visitor's existing preference. The model never selects color mode.

### 6.2 Seed palette

The v3 seed palette carries forward the proven Night Matte values while replacing Soft Field as the generated-Story default.

| Role | Light | Dark |
|---|---|---|
| Canvas | `#e9e7ef` | `#141319` |
| Primary ink | `#2e2b38` | `#e9e6f2` |
| Secondary ink | `#5a5470` | `#b3acce` |
| Matte surface | `#f6f4f9` | `#211f29` |
| Hairline | `rgba(46,43,56,0.10)` | `rgba(255,255,255,0.10)` |
| Violet emphasis | `#5646a8` | `#9d8ff2` |
| Dither field | `#bcc9e6`, `#cdb7e0`, `#eec6d5`, `#bfe2d8` | `#9d8ff2`, `#6ea3e8`, `#ef9cc2`, `#7fe0bd` |

Bright saturated one-off accents are prohibited. Themes may modulate approved tokens but cannot replace the visual language.

### 6.3 Surfaces and texture

- Surfaces are opaque matte fills with hairline borders and soft shadows.
- `backdrop-blur`, frosted glass, translucent card stacks, and the retired lava-lamp treatment are not part of v3.
- Dither/halftone texture is decorative and `aria-hidden`; meaningful content must remain in semantic HTML.
- Texture may frame Media Assets or Pattern accents but must not reduce text contrast.
- A CSS fallback matching the selected palette is always painted beneath a shader.

### 6.4 Typography

- Editorial display: serif, tight tracking, short line lengths.
- Dense register: strong sans hierarchy and compact evidence labels.
- Diagrammatic register: sans body with mono labels for nodes, periods, commands, and metadata.
- Main narrative remains readable body text; animated type never carries the only copy of a claim.

## 7. Registers

> Status: **Roadmap.** The shipped v5 contract currently exposes four registers: `editorial`, `technical`, `diagrammatic`, and `reflective`. The three-register taxonomy below is not the current generated allowlist.

Nocturne has exactly three controlled **Registers**:

### Editorial

Use for answer heroes, kinetic statements, project spotlights, media, principles, and takeaways. Favor asymmetry, generous space, serif display, and one expressive focal asset.

### Dense

Use for evidence bento, metrics, timelines, galleries, skill systems, and terminal showcases. Favor explicit hierarchy, compact matte tiles, labels, and scanability. Dense does not mean smaller text or more simultaneous animation.

### Diagrammatic

Use for comparisons, processes, architecture, stack relationships, and knowledge maps. Favor labeled relationships, directional flow, and semantic SVG. Every relationship must be grounded; decorative connecting lines cannot imply unsupported facts.

A Story uses at least two Registers. A Pattern's Register is fixed by the Catalog; the model does not invent per-Pattern art direction.

## 8. Backdrop and Tableau

### 8.1 Separate responsibilities

- **Backdrop:** ambient shader field behind content.
- **Tableau:** fixed home-only 2.5D/dithered illustration containing motifs such as the ark, waves, and logo.
- **Scene:** narrative chapter inside a generated Story.

Do not use “Scene” for the home illustration or “Background” for the composite system.

The Tableau does not react to home Story Scene entry because home content is not a generated Story. It may have subtle ambient motion but does not perform chapter-by-chapter state changes.

### 8.2 Story Presets

> Status: **Roadmap.** The shipped planner and validator currently expose every name in `BACKDROP_PRESETS`; they do not yet enforce this dither-only generated subset.

Generated Stories select one Preset from the dither family:

- `ditherTide`
- `ditherViolet`
- `ditherSky`
- `ditherEmber`
- `ditherMint`
- `ditherRose`
- `ditherIndigo`

`ambientLava`, `softField`, `nightMatte`, `meshBloom`, `metaOrbs`, and `panelParade` are not generated-Story Presets in v3. The prompt and generated schema must not expose them.

Specs select a Preset name only. Raw shader type, palette, speed, pixel size, shape, or other uniforms are renderer-owned.

### 8.3 Scene Cues

> Status: **Roadmap.** Shipped Scene Cues use the bounded `{ phase, focus, intensity }` schema and apply focus/intensity to the single Backdrop. The named `calm` / `focus` / `lift` / `resolve` vocabulary below is not the current schema.

A Scene may select one bounded Cue within the Story's chosen Preset:

- `calm`
- `focus`
- `lift`
- `resolve`

Cues steer safe preset-local state such as focal position, intensity, or phase. They never switch shader family, change the palette identity, or mount a second long-lived canvas. Cue transitions are app-owned and reduced-motion aware.

## 9. Motion and Media Assets

### 9.1 Technology decision

Use a two-tier Motion Asset stack:

1. **Motion/Framer Motion with project-owned SVG/React components** for icons, path drawing, morphing, diagrams, and Scene choreography.
2. **`@lottiefiles/dotlottie-react` with self-hosted, vetted `.lottie` files** only for multi-layer, designer-authored sequences that would be materially harder to maintain as small JSX/SVG components.

Keep `lucide-react` as the ordinary icon geometry source. Selected AnimateIcons choreography may be copied and adapted asset-by-asset only with retained MIT and underlying Lucide ISC provenance.

Do not add Rive, `lottie-react`, Anime.js, GSAP, or the licensing-ambiguous `pqoqubbw/icons` collection under this contract. Reconsidering one requires a new concrete capability need, not a desire for more variety.

### 9.2 Trusted Motion Asset registry

Generated Specs select a semantic `assetId`; they never supply markup or animation parameters. Every registry entry records:

- stable asset ID and semantic tags;
- renderer (`motion-svg` or `dotlottie`);
- local component or self-hosted file;
- intrinsic aspect ratio and responsive bounds;
- accessible title/description policy;
- playback trigger and whether replay is allowed;
- off-screen pause behavior;
- curated reduced-motion/static representation;
- source and author;
- runtime license and asset/choreography license separately.

Unknown IDs fail validation. “Found on GitHub” or “downloaded from LottieFiles” is not provenance.

### 9.3 Motion budget

Each Scene has exactly one focal animation. Supporting elements may use one-shot entrance choreography or optional focus/hover/tap micro-interactions, but they do not become concurrent ambient loops.

- Scene content reveals once on entry.
- Off-screen loops pause.
- Hover behavior has equivalent focus/tap behavior.
- Interaction may replay, inspect, or expand evidence, but required information is never interaction-gated.
- Scroll scrubbing is reserved for the Story Rail and explicitly designed diagrams; it is not the default Motion Asset driver.

### 9.4 Media Assets

Personal photos or videos enter a curated Media Asset registry with semantic tags and Evidence Refs to the projects, places, periods, or facts they depict.

- `mediaFeature` is eligible only when a relevant asset exists.
- A portrait is not inserted into every Story.
- Missing media never produces a placeholder image; another eligible Pattern and Motion Asset is selected.
- Media treatment follows Nocturne's dither/halftone framing without obscuring the subject.

## 10. Story Rail and navigation

Every Story includes a persistent, unobtrusive **Story Rail**.

- It lists short human-readable Scene labels.
- It identifies the active Scene.
- Ready labels are click, tap, and keyboard jump targets.
- One pending indicator may appear while a Scene is composing.
- Activating a target scrolls to the Scene and moves focus only when the interaction requires it; passive scroll never steals focus.
- Normal scrolling remains primary.
- On narrow screens the Rail may collapse into a compact accessible control without removing direct Scene navigation.

The final Scene's Related Questions start new Stories. Selecting one:

1. cancels unfinished work, if any;
2. enters a new Prelude;
3. pushes a new browser-history entry;
4. replaces the current Story document rather than appending another Story;
5. allows Back to restore the prior cached Story and its last scroll position.

## 11. Story identity, caching, and invalidation

> Status: **Shipped.** The current Story store uses private normalized cache identity, opaque public IDs, and Corpus/contract-version compatibility checks.

### 11.1 Cache identity

Complete Stories are reused by a key derived from:

- normalized question;
- Corpus revision;
- Story Contract version.

The storage key uses a non-reversible digest. Do not place normalized question text in KV key names.

The Story record contains the original display question, normalized digest, version stamps, validated Plan, composed Scenes, and Evidence Refs. Only complete validated Stories enter the durable cache.

### 11.2 Opaque Story IDs

A complete Story receives an opaque, non-semantic public ID and a dedicated URL such as `/ask/{storyId}`.

- The URL does not contain the raw question.
- The same current-version normalized question reuses the validated cached Story and ID.
- In-progress or aborted Stories are not shareable records.
- Share controls remain unavailable until the complete Story validates.

### 11.3 Invalidation

A Story ID is current only when both its Corpus revision and Story Contract version match the active deployment.

- **Any Corpus update invalidates all existing Story IDs.**
- **Any incompatible Story Contract/Catalog change invalidates all existing Story IDs.**
- Ordinary compatible fixes do not require a contract-version bump.
- An old URL must not replay stale Scene content.
- It renders an explicit outdated state and offers to regenerate the stored original question against current versions.
- Regeneration creates or reuses a new current Story ID; it never mutates the old ID's rendition in place.

## 12. Recovery behavior

> Status: **Shipped.** Current generation and replay paths implement bounded repair, explicit plan/service failures, and cache-failure handling.

### 12.1 Scene repair

If a planned Scene fails composition or validation:

1. retry composition against the locked Scene Plan and Evidence Refs;
2. if repair still fails, render the same claims through a deterministic **Fallback Scene** Pattern;
3. append it in the original order and continue with later Scenes.

A Fallback Scene preserves evidence and narrative role. It must not invent content, expose malformed JSON, show a generic error card, or restart the entire visible Story.

### 12.2 Plan and service failures

If no valid Story Plan can be produced after bounded retries, show a technical retry state in the Prelude. Do not misclassify a generation outage as a Boundary Story and do not fall back to retired static answers.

### 12.3 Cache failures

Cache read/write failures must not change answer semantics. A cache miss generates normally; a write failure leaves the complete Story usable in the active session but not shareable until persistence succeeds.

## 13. Accessibility and adaptive fidelity

### 13.1 Reduced motion

`prefers-reduced-motion` preserves the complete Story and replaces motion—not content:

- Backdrop speed becomes zero with a curated still frame;
- Motion SVG and dotLottie focal assets render curated static states;
- entrance sequences become immediate;
- scroll jumps avoid animated scrolling;
- the Rail, evidence, interactions, and all Scenes remain available.

### 13.2 Mobile and low-power devices

Mobile receives the same Scenes, patterns, evidence, and navigation as desktop. Adaptive fidelity may:

- reduce shader pixel density;
- simplify non-semantic transforms;
- pause all off-screen players;
- replace costly dotLottie playback with its curated static representation;
- collapse the Rail presentation while retaining direct navigation.

Do not replace Stories with generic mobile card stacks.

### 13.3 Semantic requirements

- One page-level heading; Scene headings follow a valid hierarchy.
- Each Scene is a labeled semantic region.
- Text contrast meets WCAG AA in both palettes.
- Motion Assets that communicate meaning have accessible names or equivalent text; decorative assets are hidden.
- Appended content is announced without interrupting current reading.
- Optional interactions are reachable and operable by keyboard and touch.

## 14. Performance contract

- Target validated Scene 1 within 6 seconds and complete Story within 20 seconds.
- Mount at most one full-screen Backdrop shader canvas.
- Keep one focal animation active in the visible Scene; pause off-screen players.
- Prefer Motion SVG; use dotLottie only when its richer authoring model earns the additional player cost.
- Keep static CSS fallbacks under every shader.
- Avoid cross-fading full shader families during a Story; Scene Cues stay within one Preset.
- Abort superseded model work.
- Progressive delivery appends in order and does not block scrolling through ready Scenes.

Performance degradation changes effects, never Story facts, Scene count, or access to evidence.

## 15. Validation and acceptance

> Status: **Roadmap.** These checks describe the full v3 acceptance target. Current automated validation covers the shipped seven-pattern v5 contract, not the 17-pattern experience matrix below.

Implementation is not complete until focused automated and browser-level checks prove:

### Schema and grounding

- 3–5 Scenes are required and `static` is rejected.
- Scene 1 contains the direct answer role.
- Pattern names, Registers, Motion Asset IDs, Presets, and Cues are allowlisted.
- Pattern evidence-shape requirements are enforced.
- Claims without valid Evidence Refs fail.
- Boundary Stories contain exactly the three required roles and do not infer an answer.
- Raw SVG, code, CSS, and shader params in generated data are rejected.

### Richness

- No Pattern repeats within a Story.
- At least two Registers appear.
- At least one evidence-heavy Pattern appears.
- Every Scene has one focal Motion Asset.
- The final Scene contains grounded Related Questions.
- A three-paragraph or three-heading wrapper cannot pass as a rich Story.

### Streaming and recovery

- Prelude states reflect real lifecycle phases.
- Scene 1 reveals before later Scenes.
- Scenes append in Plan order.
- The composing sentinel appears only while work is pending.
- New questions cancel old work and incomplete Stories are not cached.
- Invalid Scenes repair, then use deterministic fallback without losing earlier Scenes.

### Identity and invalidation

- Cache keys do not contain question plaintext.
- Same normalized current-version question reuses one Story.
- Opaque URLs replay only complete current-version Stories.
- Corpus or incompatible contract changes invalidate old IDs and expose the refresh path without stale content.
- Related Questions push history; Back restores the previous Story and scroll position.

### Experience

- All 17 Patterns pass light, dark, mobile, keyboard, reduced-motion, and streaming-state checks before entering the generated allowlist.
- Story Rail active state and jumps work with mouse, touch, and keyboard.
- Append operations do not steal focus or force scroll.
- Off-screen animation pauses.
- Main content remains understandable with shaders, JavaScript animation, WebGL, or motion disabled.

## 16. Clean migration from v2

The v3 cutover is intentionally clean:

| Retired v2/current behavior | v3 authority |
|---|---|
| `mode: "scenes" | "static"` | Story always contains 3–5 Scenes. |
| `StaticComposition` short-answer path | Removed; no alias or hidden emergency path. |
| Soft Field generated default | Nocturne generated language in coordinated light/dark palettes. |
| `ambientLava` generated default | Dither-family Story Preset selected by Plan. |
| Broad model-visible shader-family catalog | Seven named dither Story Presets and four bounded Scene Cues. |
| One model-produced arbitrary Catalog tree | Plan-first selection of typed Scene Patterns and trusted assets. |
| Prompt-only richness | Deterministic richness validator. |
| Whole-Spec reveal | Scene 1 first, then ordered append. |
| Normalized question text in KV key | Non-reversible versioned digest. |
| Catalog-version cache only | Corpus revision plus Story Contract version. |
| Share semantics implicit | Opaque complete-Story ID with explicit invalidation and refresh path. |
| Generated/raw animation possibility | Trusted Motion Asset registry; Motion SVG plus vetted dotLottie. |

Migration updates every generator prompt, schema, validator, renderer, cache caller, navigation caller, test, and documentation reference together. Do not leave compatibility aliases, deprecated fields, dual rendering paths, or model-visible retired Presets.