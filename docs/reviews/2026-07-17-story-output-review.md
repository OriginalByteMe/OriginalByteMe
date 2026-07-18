# Story output quality review — current baseline

**Date:** 2026-07-17  
**Model/config:** current application defaults (`deepseek/deepseek-v4-flash` through OpenRouter; no `CACTUS_*` overrides)  
**Method:** Six questions were posted concurrently to `POST /api/generate`; every NDJSON stream was read to completion and its `publicationToken` was posted to `POST /api/generate/publish`. All six generation and publication requests returned HTTP 200. The emitted plans, scene bodies, stream events, publication tokens, and publish responses are preserved verbatim in `local://before-stories.json`.

This is a review of one nondeterministic sample, not a model benchmark. It does, however, show recurring defects across unrelated questions.

## Summary

- The final emitted plans were structurally healthy in this sample: **6/6 published**, no empty `projectSlugs` arrays, and no repeated Scene Pattern within a story. That is better than the reported historical first-attempt validity, but the stream does not expose failed internal attempts.
- Content quality is much weaker than structural validity. Of 20 claims, **12 contain a named employer, project, technology, or domain fact; 7 are generic/inferred synthesis; 1 is an honest boundary statement**. Several of the 12 anchored claims still add unsupported conclusions.
- The dominant shape is a presentation template: `hero-statement` → one or two evidence scenes → `closing-synthesis`. All six use the same opening and closing patterns; none use `timeline` or `system-diagram`.
- Scene bodies often paraphrase claims instead of adding evidence. The 3D-printing story repeats essentially one corpus sentence across all three scenes.
- Asset selection is often metaphorical decoration rather than semantic illustration. Only the two 3D-printing scenes using `print-layers` and `printer-forge`, and the AI-tooling opener using `circuit-mind`, are unambiguously strong matches.
- More importantly, the real UI is **pattern-driven and does not render the selected `assetId` during normal Remotion playback**. The catalog Motion Asset is only the reduced-motion/runtime/Suspense fallback. Improving asset selection alone will not change what most visitors see.
- The car answer does not invent a vehicle, which is good, but it treats public contact links as evidence of absence and pads the refusal into unrelated portfolio promotion.

## Plan quality

### Structure and repetition

| Question | Emitted scene plan (`title` — pattern / register / asset) |
|---|---|
| What car does Noah drive? | “No car on record” — `hero-statement` / editorial / `morning-coffee`; “What I actually build” — `evidence-ledger` / technical / `print-layers`; “The bigger picture” — `closing-synthesis` / reflective / `morning-coffee` |
| What does Noah do at MerchantSpring? | “Current Role” — `hero-statement` / editorial / `circuit-mind`; “Full-Stack Scope” — `evidence-ledger` / technical / `print-layers`; “Impact” — `closing-synthesis` / reflective / `printer-forge` |
| How does Noah balance engineering and design? | “One integrated craft” — `hero-statement` / editorial / `circuit-mind`; “Projects that prove the blend” — `project-spotlight` / technical / `print-layers`; “Spanning the spectrum” — `capability-map` / diagrammatic / `container-stack`; “Iteration as the balance” — `closing-synthesis` / reflective / `morning-coffee` |
| What is Noah’s experience with 3D printing? | “Hands-On 3D Printing” — `hero-statement` / editorial / `circuit-mind`; “From CAD to Finished Part” — `evidence-ledger` / technical / `print-layers`; “Making Things That Matter” — `closing-synthesis` / reflective / `printer-forge` |
| Which projects best show Noah’s technical range? | “Full-Stack Range” — `hero-statement` / editorial / `circuit-mind`; “Image & Language Tools” — `project-spotlight` / technical / `printer-forge`; “Generative Portfolio & Color” — `capability-map` / diagrammatic / `container-stack`; “Synthesis of Skills” — `closing-synthesis` / reflective / `morning-coffee` |
| What tools does Noah use for AI and LLM development? | “AI & LLM Toolchain” — `hero-statement` / technical / `circuit-mind`; “Evaluation in Practice” — `evidence-ledger` / diagrammatic / `data-center`; “Why This Stack Matters” — `closing-synthesis` / editorial / `morning-coffee` |

Across 20 scenes, the pattern distribution is `hero-statement` 6, `closing-synthesis` 6, `evidence-ledger` 4, `project-spotlight` 2, and `capability-map` 2. The titles “Current Role,” “Impact,” “The bigger picture,” “Spanning the spectrum,” “Making Things That Matter,” “Synthesis of Skills,” and “Why This Stack Matters” are interchangeable slide headings rather than story-specific editorial choices.

### Claim specificity

- **Car:** the opening is appropriately a boundary claim: “I don't have any information about the car I drive.” Scene 2 is concrete (“marketplace analytics, data-labeling tooling, and LLM evaluation tools”), but is unrelated to the question. Scene 3 is pure slideware: “my portfolio shows the kind of work I do.”
- **MerchantSpring:** the first two claims are checkable: “Senior AI Engineer at MerchantSpring,” “marketplace analytics for e-commerce sellers and agencies,” and “backend services, data pipelines, and frontend development.” The closing claim—“cohesive, reliable analytics tools that directly help sellers and agencies make better decisions”—adds outcomes that are not in the cited career excerpt.
- **Engineering and design:** “two sides of the same craft” is a philosophy invented from a generic bio, not a checkable fact. Ask-Me Portfolio, Moodify, the named tool stack, and FDM are concrete. “layer by layer, I refine both the look and the logic” is an attractive metaphor, not evidence.
- **3D printing:** role, employer, year, FDM, CAD, and high-end materials are checkable. “functional parts” is not stated in either cited excerpt. “a core part of my maker identity” is generic interpretation.
- **Technical range:** the four named projects and their basic functions are concrete. “showing the full stack of my technical range” and “my ability to work across AI, infrastructure, and user experience” are broad conclusions; the cited project excerpts do not themselves establish infrastructure work.
- **AI/LLM tools:** the tool list and Supa/LLM Comparison app are checkable. “using these frameworks” is not established by the cited app evidence, and “bridging prototyping with production” is generic positioning.

The planner can select evidence IDs correctly while still making a conclusion that the excerpt does not entail. Evidence attachment is therefore not the same as grounding.

## Scene body quality

### Verbatim examples and redundancy by story

#### 1. What car does Noah drive?

- Claim: “I don't have any information about the car I drive.”
- Body: “My public contact links show no details about any car I might drive.”
- Closing claim: “While I can't answer that specific question, my portfolio shows the kind of work I do.”
- Closing body: “I can't answer that specific question, but my portfolio—the site you're on right now, built with an LLM composing answers from a component catalog, and Moodify, which pulls album‑cover palettes into the page—shows exactly the kind of work I do.”

The first body merely restates the absence claim and uses unrelated contact links as proof. The next two scenes abandon the car question and turn the refusal into a portfolio advert. “The bigger picture” and “shows exactly the kind of work I do” are filler around otherwise concrete project facts.

#### 2. What does Noah do at MerchantSpring?

- Opening claim: “I am a Senior AI Engineer at MerchantSpring, focused on building marketplace analytics for e-commerce sellers and agencies.”
- Opening body: “I currently build marketplace analytics for e-commerce sellers and agencies as a Senior AI Engineer at MerchantSpring, working full-stack across backend services, data pipelines, and frontend.”
- Evidence claim: “My work spans backend services, data pipelines, and frontend development, supported by infrastructure and DevOps skills.”
- Evidence body: “At MerchantSpring, my work covers the full stack—backend services, data pipelines, and frontend—backed by infrastructure and DevOps skills like Docker, Proxmox, and Terraform.”
- Closing body: “By working across every layer—backend services, data pipelines, and frontend—I ensure the analytics tools I ship are cohesive and reliable, directly helping sellers and agencies make better decisions.”

This has a coherent role → scope → outcome order, but each scene repeats “backend services, data pipelines, and frontend.” The closing turns that repeated inventory into unsupported impact language: “cohesive and reliable” and “make better decisions.”

#### 3. How does Noah balance engineering and design?

- Opening claim: “I see engineering and design as two sides of the same craft, not separate disciplines.”
- Project body: “Ask-Me Portfolio pairs an LLM-backed backend that generates JSON specs with a frontend that renders them over a WebGL shader backdrop. Moodify blends a search-driven backend that extracts album color palettes with a frontend that dynamically recolors the page—each project marrying design and engineering.”
- Capability body: “I work across Ruby, Python, JavaScript, TypeScript, and Node.js, pair Next.js, Rails, and Tailwind CSS for frontend work, and manage Docker, Proxmox, Unraid, AWS, and Terraform for infrastructure. On the side, I dive into 3D printing with FDM and high-end materials.”
- Closing body: “I refine both the look and the logic through iteration—whether I'm polishing a UI component or adjusting a 3D print, each layer brings me closer to balance.”

The project scene is the strongest scene in this story because it names observable mechanisms. The capability scene becomes a résumé list rather than evidence of *how* balance is achieved. The ending repeats the invented “iteration” thesis and adds “polishing a UI component,” which is not in the cited excerpts. Flow exists, but the evidence does not actually prove the opening philosophy.

#### 4. What is Noah’s experience with 3D printing?

- Scene 1 body: “Since 2023, I've worked as a CAD designer and 3D printing engineer at Bowiq, operating FDM machines with high-end materials.”
- Scene 2 body: “Since 2023, I've been designing functional parts in CAD and printing them on FDM machines with premium materials at Bowiq.”
- Scene 3 body: “Since 2023, I have been designing and fabricating with FDM 3D printing and high-end materials at Bowiq, which is how I combine CAD, engineering, and hands-on making.”

All three bodies repeat the same year, employer, CAD/FDM, and materials fact. Scene 2 introduces “functional parts,” which is absent from the evidence. Scene 3 wraps the same sentence in “maker identity” and “Making Things That Matter.” This is the clearest placeholder-PPT failure: a single fact is stretched into three slides rather than developed.

#### 5. Which projects best show Noah’s technical range?

- Opening body: “From a computer vision cutout tool using Segment Anything, to an LLM comparison app, to the generative UI of this very portfolio, and a color extraction app that recolorizes the hero — these projects demonstrate my full-stack technical range.”
- Project body: “I built a fun little app that uses Segment Anything to cut people and objects out of images for stickers, and an open-source LLM Comparison app where users can pit two models side by side.”
- Portfolio/Moodify body: “The portfolio you're exploring uses an LLM to compose each answer as a JSON spec, rendered from a component catalog. Meanwhile, Moodify extracts album-cover color palettes, and that same trick now recolors this site's hero dither.”
- Closing body: “The AI image cutout, LLM comparison, this portfolio, and Moodify highlight my ability to work across AI, infrastructure, and user experience.”

Scenes 2 and 3 contain concrete mechanisms. Scenes 1 and 4 are redundant summaries of the same four-project list. The closing adds “infrastructure” without explaining which project demonstrates it. “Full-Stack Range” and “Synthesis of Skills” read as deck section labels, not a narrative.

#### 6. What tools does Noah use for AI and LLM development?

- Opening body: “I build AI and LLM workflows using LangChain for orchestration, Langfuse for observability, Ollama for local inference, Hugging Face for model access, and OpenRouter for multi-provider API routing.”
- Evidence body: “At Supa, I built LLM evaluation tooling and shipped the open-source LLM Comparison app, which lets users pit two models against each other.”
- Closing claim: “My AI toolset emphasizes open-source frameworks and hands-on evaluation, bridging prototyping with production.”
- Closing body: “I rely on open-source tools like LangChain and Ollama, and building the LLM Comparison app let me validate ideas in prototype before pushing them into production.”

The corpus provides a list of tool names, but not the per-tool uses assigned in scene 1. Those descriptions are plausible industry knowledge, not portfolio evidence. Likewise, the cited material does not say the comparison app moved prototypes into production. The story has a sensible list → example → synthesis shape, but its most polished phrases—“bridging prototyping with production” and “validate ideas in prototype before pushing them into production”—are the least grounded.

### Cross-story body findings

1. **Bodies frequently repeat the claim.** In the UI, claim and body are adjacent, so paraphrase is especially visible. MerchantSpring scene 3 and technical-range scene 4 are near duplicates; all three 3D-printing scenes repeat one fact.
2. **Synthesis is where grounding weakens.** The model converts named facts into uncheckable value statements: “make better decisions,” “core part of my maker identity,” “ability to work across,” and “bridging prototyping with production.”
3. **World knowledge leaks into evidence prose.** Tool functions, “functional parts,” Moodify’s “search-driven backend,” and prototype-to-production impact are not contained in the cited excerpts.
4. **Narrative flow is usually classification, not progression.** Most stories say answer → list → generic conclusion. The technical-range pair grouping is useful; the 3D story has no progression at all.

## Animation and asset semantics

### Catalog baseline

The catalog contains eight records, but `spark-loader` is `generatorEligible: false` and therefore is not offered to the planner.

| Asset | Catalog meaning and tags |
|---|---|
| `printer-forge` | A working 3D printer turns digital intent into a physical object; `3d-printing`, `fabrication`, `making`, `delivery` |
| `print-layers` | A 3D form emerges from precise stacked layers; `3d-printing`, `layers`, `evidence`, `iteration` |
| `circuit-mind` | A robot brain/circuit model of technical reasoning; `ai`, `systems`, `reasoning`, `architecture` |
| `spark-loader` | Ambient decorative loading sparkle; `loading`, `sparkles`, `ambient`, `decorative`; not generator-eligible |
| `data-center` | Dependable product infrastructure represented by server racks; `infrastructure`, `servers`, `operations`, `evidence` |
| `server-sweep` | Ordered server maintenance/cleanup; `servers`, `maintenance`, `operations`, `timeline` |
| `container-stack` | Deployable infrastructure/composable services; `containers`, `docker`, `infrastructure`, `deployment` |
| `morning-coffee` | A human technical-craft ritual; `coffee`, `ritual`, `craft`, `synthesis` |

### Per-scene semantic fit

| Story / scene | Selected asset | Assessment against catalog semantics |
|---|---|---|
| Car 1, “No car on record” | `morning-coffee` | **Mismatch.** Coffee/human rhythm has no semantic relation to unavailable car data. |
| Car 2, “What I actually build” | `print-layers` | **Mismatch.** Marketplace analytics, labeling, and LLM evaluation are not 3D layers or fabrication. `evidence` is too broad a tag to make this meaningful. |
| Car 3, “The bigger picture” | `morning-coffee` | **Weak.** `synthesis` pattern eligibility is satisfied, but the coffee ritual adds no meaning to the portfolio detour. |
| MerchantSpring 1, “Current Role” | `circuit-mind` | **Partial.** The role is AI engineering, so `ai` fits; the claim itself is marketplace analytics rather than reasoning/architecture. |
| MerchantSpring 2, “Full-Stack Scope” | `print-layers` | **Weak metaphor.** “Layers” loosely echoes full-stack, but the catalog visual specifically depicts 3D printing. |
| MerchantSpring 3, “Impact” | `printer-forge` | **Mismatch.** “Ship”/`delivery` is being used as a generic software metaphor for a literal 3D-printer asset. |
| Engineering/design 1, “One integrated craft” | `circuit-mind` | **Partial.** Systems/reasoning covers engineering, not the claimed design-engineering integration. |
| Engineering/design 2, project spotlight | `print-layers` | **Weak.** It illustrates neither the LLM component catalog nor album-color extraction; “iteration” is not in the scene. |
| Engineering/design 3, capability map | `container-stack` | **Partial/strong for one slice.** Docker/infrastructure is explicitly named, but frontend design and 3D printing are equally central to the claim. |
| Engineering/design 4, synthesis | `morning-coffee` | **Weak.** `craft`/`synthesis` loosely fits, but the scene is about iteration and 3D layers, not coffee or ritual. |
| 3D printing 1, direct answer | `circuit-mind` | **Mismatch.** A 3D-printer asset would be direct; the selected AI brain is unrelated. |
| 3D printing 2, evidence | `print-layers` | **Strong.** FDM construction and layered fabrication match exactly. |
| 3D printing 3, synthesis | `printer-forge` | **Strong.** CAD-to-physical fabrication is exactly the catalog meaning. |
| Technical range 1, direct answer | `circuit-mind` | **Partial.** AI is one of four domains, but the visual overweights it. |
| Technical range 2, image/LLM projects | `printer-forge` | **Mismatch.** Neither Segment Anything nor model comparison is 3D fabrication. |
| Technical range 3, portfolio/Moodify | `container-stack` | **Mismatch.** The claim is generative UI and color extraction, not Docker, containers, or deployment. |
| Technical range 4, synthesis | `morning-coffee` | **Weak.** A generic “craft” sign-off is decoration, not a visualization of AI/infrastructure/UX range. |
| AI tools 1, toolchain | `circuit-mind` | **Strong.** AI systems and reasoning fit the toolchain. |
| AI tools 2, evaluation | `data-center` | **Partial.** It conveys operational infrastructure, but the evidence is model comparison/evaluation, not servers or operations. |
| AI tools 3, synthesis | `morning-coffee` | **Mismatch.** Open-source evaluation and prototype-to-production claims have no coffee/ritual content. |

Asset frequency reinforces the template effect: `circuit-mind` 5, `morning-coffee` 5, `print-layers` 4, `printer-forge` 3, `container-stack` 2, `data-center` 1, and `server-sweep` 0. The model repeatedly uses `morning-coffee` as a generic closing icon and interprets 3D “layers”/“delivery” as generic software metaphors.

### What visitors actually see

I inspected and scrolled two published stories in Chromium at 1440×1000:

- `/ask/rmPU3hiTuosBxidpT-2yg0wN` — technical range, all four scenes
- `/ask/_Hu7CQLh-wLyvSM_tD6JV-6L` — car boundary answer, all three scenes

Representative captures were taken at:

- `/tmp/story-review-technical-range-scene-2.png`
- `/tmp/story-review-car-scene-1.png`
- `/tmp/story-review-car-scene-3.png`

The visitor first sees the question as a large page heading, a sticky left “SCENES” rail, and a large 16:9 animation stage. The role/index chip sits at the stage’s top-left. Below the stage, the claim is prominent, the body is lower-contrast prose directly underneath, and project links follow. Evidence is behind a small “Sources for this claim” button.

Pattern compositions also render story text inside the animation:

- In the car hero, “No car on record” and “I don't have any information about the car I drive” appear large inside the stage. The canonical claim appears again below the stage, followed by the body. At the initial viewport, that body is below the fold, so the visitor initially sees only the refusal claim.
- In the technical-range project spotlight, the stage carries “Image & Language Tools” and animated project-card presentation; the claim and body sit immediately below. The broad phrase “AI Image Cutout uses segment anything …” is therefore followed at once by a body that says nearly the same thing.
- In the car closing synthesis, the animation displays the three scene titles as floating cards. Directly beneath it, the generic claim “my portfolio shows the kind of work I do” is the highest-contrast text, followed by a longer paraphrase. The visual polish makes the filler more conspicuous, not less.

**Critical implementation fact:** normal presentation is selected by `SCENE_COMPOSITIONS[scene.pattern]`. The Remotion composition subtree does not read `scene.assetId`. `MotionAsset assetId={scene.assetId}` is supplied only as the reduced-motion, Suspense, or runtime-error fallback. Therefore, the selected `morning-coffee`, `printer-forge`, and other catalog assets assessed above are plan metadata under normal playback, not the animation visitors see. Prompt-side asset improvements cannot improve normal UI semantics until that integration gap is resolved.

## Boundary behavior

The car story correctly refuses to name a vehicle. There is no fabrication such as a make or model. That is the strongest part of the output.

It still stretches in three ways:

1. “My public contact links show no details about any car I might drive” treats a contact-link list as evidence that no answer exists. Absence from that unrelated excerpt is not evidence.
2. “What I actually build” inserts marketplace analytics, data labeling, and LLM evaluation into a car answer. Those facts are true but irrelevant.
3. “The bigger picture” then promotes Ask-Me Portfolio and Moodify. The answer becomes a generic three-scene portfolio funnel instead of an honest boundary response.

A grounded boundary answer would be:

> I don't have a reliable source in Noah's portfolio for what car he drives, so I can't answer without guessing. I can answer questions about his work at MerchantSpring, his projects, AI tooling, or 3D printing.

Within the required direct-answer/evidence/synthesis arc, the evidence scene should describe the *available corpus coverage* without attaching an unrelated citation as proof of absence, and the synthesis should offer answerable alternatives rather than pretend unrelated projects answer the question.

## Related questions

### Verbatim output and quality

- **Car:** “What projects have you built?”, “What is your professional background?”, “Where are you located?” All are generic escape hatches. The first follows the story’s detour; none helps clarify the unanswered car question. They are at least likely answerable by the corpus.
- **MerchantSpring:** “What did you build during your time at Supa?”, “What programming languages and tools do you use most often?”, “Can you tell me about your Ask-Me Portfolio project?” All are answerable, but only the Supa comparison is a natural continuation. The other two discard the MerchantSpring topic instead of asking about analytics, data pipelines, or the current role.
- **Engineering/design:** “What is the Ask-Me Portfolio and how does it work?”, “How does Noah's 3D printing background shape his engineering approach?” The first is grounded and relevant. The second asks for a causal influence not present in the corpus and is likely to produce another invented philosophy.
- **3D printing:** “What is your role at Bowiq?”, “What do you enjoy most about 3D printing?”, “What other maker skills do you have?” Bowiq is grounded. Enjoyment and other maker skills are not supported by the supplied 3D evidence.
- **Technical range:** “How does the Ask Me Portfolio generate its answers?”, “What infrastructure does Noah use for self-hosting?”, “Can you tell me more about the Moodify project?” These are the best set: specific, varied, and plausibly supported elsewhere in the corpus, although the self-hosting question should only be offered if the retrieved corpus contains that detail.
- **AI/LLM tools:** “Does Noah self-host any of these AI/LLM tools on his homelab?”, “What other programming languages does Noah use for backend development?”, “How does Noah’s portfolio site itself leverage AI or LLM techniques?” The latter two are grounded. The first combines two corpus themes into a specific claim (“these tools” on a homelab) that the current evidence does not establish.

The recurring defect is that related questions are generated for conversational appeal rather than checked answerability. Several are invitations to fabricate the next story.

## Prioritized recommendations

1. **P0 — Make entailment explicit for both claims and bodies.** Every factual sentence must be directly supported by one or more cited excerpts. A list of tool names does not authorize invented usage details; a job description does not authorize invented outcomes. Require the planner/composer to identify the exact supporting phrase before writing.
2. **P0 — Add an honest-boundary mode without changing the three-role validator contract.** If no evidence answers the question: direct answer = explicit uncertainty; evidence = what the corpus actually covers, without using unrelated records as negative proof; synthesis = grounded alternatives. Prohibit padding with unrelated portfolio achievements as if they answer the question.
3. **P0 — Require bodies to add information.** A body must introduce at least one new grounded detail, contrast, chronology, mechanism, or example not already present in the claim. If evidence cannot support expansion, keep the sentence direct rather than paraphrasing it. Explicitly reject claim/body pairs with the same nouns and conclusion reordered.
4. **P1 — Ban placeholder slide language.** Add negative examples for “The bigger picture,” “Impact,” “Synthesis of Skills,” “Why This Stack Matters,” “shows the kind of work I do,” “ability to work across,” “core part of my identity,” and “bridging prototyping with production.” Titles should name the actual fact or tension in the scene.
5. **P1 — Make synthesis evidence-preserving.** The final scene should connect named facts already established, not upgrade them into generic impact. For example, the MerchantSpring synthesis can connect backend, pipelines, and frontend as an end-to-end scope; it cannot claim reliability or better decisions unless the corpus says so.
6. **P1 — Enforce semantic asset choice rather than pattern eligibility alone.** Require overlap between the scene’s concrete subject and catalog description/tags. Forbid `printer-forge`/`print-layers` as generic metaphors for software delivery or stack layers, and forbid `morning-coffee` as a default closing asset. Also acknowledge that the current catalog has no honest semantic match for an unavailable-car boundary scene.
7. **P1 — Wire selected assets into normal scene presentation, or remove the misleading selection requirement.** This is outside prompt-only work but blocks the intended visitor benefit: today `assetId` only controls fallback rendering, while normal visitors see pattern compositions. Prompt tuning cannot fix that implementation gap.
8. **P2 — Give each scene a distinct narrative job.** Direct answer should answer; evidence scenes should each prove a different part using distinct facts; synthesis should state the specific connection. Do not spend both opening and closing scenes summarizing the same project list.
9. **P2 — Generate only corpus-answerable related questions.** Before emitting each question, require at least one known evidence ID that could answer it. Reject causal, preference, and deployment questions unless the corpus explicitly contains that information.
10. **P2 — Increase plan variety only when evidence warrants it.** Use `timeline` for dated progression and `system-diagram` for an actual architecture. Do not force every story into hero/evidence/closing slide rhythm when a more concrete pattern is supported.

The highest-leverage prompt change is not more stylistic instruction. It is a hard distinction between **entailed fact**, **clearly labeled inference**, and **unknown**, combined with a non-redundancy rule for adjacent claim/body text.

## After: 2026-07-17 prompt + composition changes

### Sample and method

The same six questions were generated against the revised prompts with the application defaults (`deepseek/deepseek-v4-flash` through OpenRouter; no `CACTUS_*` overrides), then published. The dev server used `STORY_CACHE_HMAC_KEY=devsecret` and `STORY_CACHE_HMAC_KEY_ID=dev`. All six generation requests were cache misses, all six generation requests returned HTTP 200, and all six publication requests returned HTTP 200.

The complete AFTER records—including response headers, raw NDJSON streams, parsed events, final plans, scene bodies, publication tokens, publish responses, and event timings where captured—are preserved verbatim in `local://after-stories.json`.

| Question | Published Story | Plan emitted | Generation complete | Generate / publish |
|---|---|---:|---:|---|
| What car does Noah drive? | `yzCnuDAAIVyWw1Vl1Inc06uo` | not separately timed | 83.495 s | 200 / 200 |
| What does Noah do at MerchantSpring? | `f17eif6P7vsHIfhA_WI7f6sh` | 39.890 s | 68.847 s | 200 / 200 |
| How does Noah balance engineering and design? | `SPEA1n8ScCfj2IecnhwZD9EU` | 49.172 s | 80.281 s | 200 / 200 |
| What is Noah's experience with 3D printing? | `pwdfxBeLTUlO3wo_abE8Kr_u` | 54.099 s | 103.557 s | 200 / 200 |
| Which projects best show Noah's technical range? | `_wg2fplsCCLLyibQyRyPzXEL` | 44.444 s | 121.428 s | 200 / 200 |
| What tools does Noah use for AI and LLM development? | `1uoZjs2kpWI8YZZ0-BxlvDfN` | 24.015 s | 117.558 s | 200 / 200 |

No generation error, validation error, or explicit repair event appeared in any stream or in the server log. Each stream exposed one plan followed by three scenes. The long gaps before some final scenes—27.911 seconds for technical range and 53.704 seconds for AI tooling—could be ordinary provider latency or an internal repair, but the observable data cannot distinguish those cases; they are not counted as repair rounds.

### AFTER plans

| Question | Emitted scene plan (`title` — pattern / asset) |
|---|---|
| Car | “No Car Information Available” — `hero-statement` / `circuit-mind`; “Corpus Coverage: Career, Skills, and Projects” — `evidence-ledger` / `print-layers`; “Redirecting to Answerable Questions” — `closing-synthesis` / `morning-coffee` |
| MerchantSpring | “Senior AI Engineer at MerchantSpring” — `hero-statement` / `circuit-mind`; “Full-Stack Developer in Practice” — `evidence-ledger` / `data-center`; “Analytics for E-Commerce Sellers and Agencies” — `closing-synthesis` / `morning-coffee` |
| Engineering and design | “Full-stack developer with a design eye” — `hero-statement` / `circuit-mind`; “Frontend frameworks and a visual project” — `capability-map` / `data-center`; “End-to-end tooling and a portfolio driven by LLMs” — `closing-synthesis` / `morning-coffee` |
| 3D printing | “CAD Designer and 3D Printing Engineer at Bowiq” — `hero-statement` / `circuit-mind`; “Professional and Personal 3D Printing Focus” — `evidence-ledger` / `print-layers`; “Dedication to FDM and High-End Materials” — `closing-synthesis` / `printer-forge` |
| Technical range | “Ask-Me Portfolio and LLM Comparison App” — `hero-statement` / `circuit-mind`; “LLM Pipeline and Open-Source Comparison” — `capability-map` / `data-center`; “Full-Stack and AI Engineering Across Two Projects” — `closing-synthesis` / `morning-coffee` |
| AI/LLM tools | “AI and LLM Development Tooling” — `hero-statement` / `circuit-mind`; “The LLM Comparison App” — `capability-map` / `circuit-mind`; “Connecting the tools to the app” — `closing-synthesis` / `morning-coffee` |

The AFTER pattern distribution is `hero-statement` 6, `closing-synthesis` 6, `evidence-ledger` 3, and `capability-map` 3 across 18 scenes. As in the baseline, every story still uses a hero opener and closing-synthesis ending. Neither `timeline` nor `system-diagram` was selected, even though the Ask-Me Portfolio excerpt describes an explicit LLM → JSON spec → component-catalog rendering path.

### Criterion verdicts

| Criterion | Verdict | Factual before/after comparison |
|---|---|---|
| Title genericness | **Improved** | The 11 title strings explicitly banned by the new prompt occurred **7/20** times before (“The bigger picture,” “Current Role,” “Impact,” “Making Things That Matter,” “Full-Stack Range,” “Synthesis of Skills,” and “Why This Stack Matters”) and **0/18** times after. AFTER titles name facts more often, for example “Senior AI Engineer at MerchantSpring.” Some remain deck-like or procedural: “AI and LLM Development Tooling” and “Redirecting to Answerable Questions.” |
| Claim specificity | **Improved** | The baseline had 12/20 claims with a named employer, project, technology, or domain fact, seven generic/inferred claims, and one boundary claim. AFTER has one boundary claim and **17/17 non-boundary claims containing at least one checkable named fact**. Examples include “Since 2023, I've been a CAD Designer and 3D Printing Engineer at Bowiq” and “I use LangChain, Langfuse, Ollama, Hugging Face, and OpenRouter.” Specificity does not guarantee entailment: the AI-tool synthesis still asserts an unsupported relationship. |
| Body value-add versus claim paraphrase | **Improved, not fixed** | All 18 AFTER bodies satisfy the requested 2–4 sentence length. Most add at least one grounded detail: the MerchantSpring opener adds “backend services, data pipelines, and frontend development” to the role claim, and the Moodify body adds Tailwind CSS plus the hero-dither reuse. Five scenes still fail or substantially miss the value-add rule: the car opener uses irrelevant negative proof; 3D-printing scenes 2 and 3 restate their claims; technical-range scene 2 repeats its two mechanisms; and the AI-tool opener repeats the five-name list before adding only “That's the tooling I rely on.” |
| Cross-scene fact repetition | **Regressed** | The baseline's one-fact-three-slides 3D story remains. AFTER scene bodies repeat “Bowiq,” “Since 2023,” “FDM,” and “high-end materials” in all three scenes; the last says, “My personal 3D printing interest is the same: FDM and high-end materials.” In addition, the technical-range story shrank from four distinct projects to two and repeats the Ask-Me Portfolio mechanism and LLM Comparison app in every scene. MerchantSpring also repeats marketplace analytics plus the backend/pipelines/frontend inventory three times. |
| Car-question boundary honesty | **Improved, not fixed** | BEFORE used contact links as negative proof—“My public contact links show no details about any car I might drive”—then advertised unrelated work. AFTER starts more precisely: “The corpus does not contain any information about a car,” and ends with answerable redirects to Supa, LLM Comparison, and self-hosting. However, its first body still uses an unrelated excerpt as negative proof: “My profile headline identifies me as a Full-Stack Developer, but it contains no information about a car.” The middle scene is explicitly corpus coverage rather than pretending projects answer the car question, but it is still a long detour. |
| Related-question answerability | **Improved** | The baseline offered unsupported preference/causal questions such as “What do you enjoy most about 3D printing?” and “How does Noah's 3D printing background shape his engineering approach?” Every AFTER suggestion has a plausible corpus route. Strong examples are “What open-source project did Noah ship for LLM evaluation?”, “What company does Noah work for as a 3D printing engineer?”, and “How does the Ask-Me Portfolio generate its pages?” Two remain synthesis-shaped rather than direct lookups—“How does Noah's portfolio site demonstrate his engineering and design skills?” and “Which projects has Noah built and open-sourced?”—but neither requires a new preference or causal fact. |
| Asset and pattern semantic fit | **Same overall; mixed movement** | Software scenes no longer use `printer-forge` as a shipping metaphor, and `data-center` is a better fit for MerchantSpring backend/data-pipeline scope than the old `print-layers`. But `morning-coffee` remains at **5 uses before and 5 after**, again serving as the default closer; the car corpus-coverage scene still uses literal 3D `print-layers`; Moodify/frontend work uses a server-rack `data-center`; and the 3D opener still uses the AI-brain `circuit-mind`. Pattern variety also did not improve: the same hero/closing frame appears in all six stories, with zero timelines and zero system diagrams. |
| Invented facts / entailment | **Improved, not fixed** | BEFORE invented per-tool uses (“LangChain for orchestration,” “Langfuse for observability,” “Ollama for local inference”), outcomes (“make better decisions”), “functional parts,” and a prototype-to-production story. AFTER correctly presents the five AI tools as a list and removes the MerchantSpring outcome claim and “functional parts.” Strict entailment violations remain and are listed below. |

### Specificity and body findings by story

- **Car:** the opening is an honest boundary rather than a guessed make/model. The two remaining claims contain concrete corpus-coverage facts, but the body still cites the unrelated profile headline to establish absence.
- **MerchantSpring:** all three claims are specific and source-supported. The new titles are better; the story itself is nearly three rewrites of the same two career highlights.
- **Engineering/design:** each claim now names evidence—MerchantSpring scope, Next.js/Rails/Moodify, then Supa/Ask-Me Portfolio—instead of leading with the invented “two sides of the same craft” philosophy. This is more factual, but it answers by inventory rather than explaining a documented balancing practice.
- **3D printing:** employer, role, timeframe, FDM, machines, materials, and personal interest are checkable. There is still not enough source material for three distinct scenes, and the composer pads the same fact instead of shortening the story.
- **Technical range:** the selected projects are concrete, but using only Ask-Me Portfolio and LLM Comparison narrows the demonstrated range compared with the baseline's AI Image Cutout + LLM Comparison + Ask-Me Portfolio + Moodify grouping. The two-project mechanism is repeated three times.
- **AI/LLM tools:** the opening list is now honest about what the source establishes. The synthesis reintroduces the exact relationship the evidence does not establish: that those named tools powered the LLM Comparison app or Supa's data-labeling tooling.

### Remaining entailment violations

The following AFTER clauses are not stated by the cited `content/about-me/*` excerpts:

1. **Engineering/design:** “I bring ideas to life through code, working from data-heavy services to polished interfaces.” `bio.md` says “bring ideas to life through code” and mentions a “keen eye for design,” but never says the interfaces are polished.
2. **3D printing:** “Both my professional and personal projects rely on the same technology and material choices.” `fun-facts.md` says only “Into 3D printing / CAD (FDM, high-end materials)”; it does not establish personal projects or reliance on identical choices.
3. **Technical range:** “the infrastructure behind end-to-end data tooling.” `career.md` says the Supa tooling was built end to end, not that infrastructure was part of the cited work. The related phrase “LLM orchestration” is also stronger than `ask-me-portfolio.md`'s narrower statement that an LLM composes a JSON spec.
4. **AI/LLM tools:** “The AI and LLM tooling I use powers projects like the LLM Comparison app, which I built end-to-end.” The source lists tools separately, says the app was shipped, and attaches “end to end” to data-labeling and AI training-data tooling—not to the comparison app.
5. **AI/LLM tools:** “I also use these tools to build data-labeling and AI training-data tooling end to end.” No excerpt connects LangChain, Langfuse, Ollama, Hugging Face, or OpenRouter to that Supa work.
6. **LLM Comparison body:** “allowing users to see how different models compare in a side-by-side format.” The project source says users can pit two LLMs against each other and compare them; it does not state a side-by-side UI.

### Browser and composition verification

I opened the published car and MerchantSpring stories in Chromium at 1440×1000. Representative captures:

- `/tmp/story-after-car-boundary.png`
- `/tmp/story-after-car-evidence-ledger.png`
- `/tmp/story-after-merchantspring-evidence-ledger.png`

The car boundary capture visibly renders “No Car Information Available” and “The corpus does not contain any information about a car” inside the hero composition, with the same claim and the two-sentence boundary body below it.

The new evidence-label rendering is real rather than plan-only metadata:

- Car evidence ledger: “SENIOR AI ENGINEER AT MERCHANTSPRING,” “FULL-STACK DEVELOPER AT SUPA (FORMERLY SUPAHANDS),” “PROGRAMMING LANGUAGES SKILLS,” “AI & LLM TOOLING SKILLS,” and “LLM COMPARISON APP,” ending at “05 OF 05 MATCHED.”
- MerchantSpring evidence ledger: “PROFILE HEADLINE” and “SENIOR AI ENGINEER AT MERCHANTSPRING,” both marked “MATCHED,” ending at “02 OF 02 MATCHED.”

Remaining visual weaknesses are visible in the captures: the “02 EVIDENCE” pill overlaps the “EVIDENCE LEDGER” heading, long scene titles in the left rail truncate to ellipses, and the ledger leaves a large empty region while pushing the body lower on the page. No sampled plan selected `system-diagram` or `timeline`, so the SystemAssembly evidence labels and NightDrive factual Timeline chip were not exercised by this six-question AFTER corpus.

### Remaining gaps

- The prompt bans exact filler headings successfully, but it has not broken the universal hero → middle → closing deck template.
- Distinct scene jobs are still the largest content failure: 3D printing, MerchantSpring, and technical range repeat facts instead of progressing.
- Honest-boundary mode improves the refusal and redirect, but still permits an unrelated evidence excerpt to be used as negative proof.
- Tool lists are no longer expanded into invented per-tool functions, but the composer still invents links between those tools and specific work.
- Semantic asset choice remains weak for generic closers and for subjects without a catalog match.
- The visible EvidenceLedger labels are useful, but layout overlap and rail truncation need visual cleanup; SystemAssembly and NightDrive still need a generated-story browser check.

### Iteration 2

The prompt-only follow-up was exercised against the same six questions with `STORY_CACHE_HMAC_KEY=devsecret`, `STORY_CACHE_HMAC_KEY_ID=dev`, the default model, and no `CACTUS_*` overrides. Each final generation was a cache miss, and all six successful generate/publish pairs returned HTTP 200. Three earlier streams (two car attempts and one engineering/design attempt) ended in typed plan-validation errors and were retried; they produced no story. `npx vitest run lib/llm/__tests__/prompt.test.ts` passes all seven tests. The project-role rule was added and test-covered after this final sample exposed the ownership gap; it was not behaviorally regenerated because the one allowed tightening/regeneration cycle had already completed.

| Question | Published Story | Scenes | Generate / publish |
|---|---|---:|---|
| What car does Noah drive? | `eRpWk1yEyQtsl57SqL_Tpo63` | 3 | 200 / 200 |
| What does Noah do at MerchantSpring? | `E3hrAhFG-_pGbQ9kELlgouHx` | 3 | 200 / 200 |
| How does Noah balance engineering and design? | `cp9PedSQ0izGH0O4kYB024s8` | 3 | 200 / 200 |
| What is Noah's experience with 3D printing? | `c0TQZzxJe03FInXU-aTIAyzf` | 3 | 200 / 200 |
| Which projects best show Noah's technical range? | `Rt4NKpHb8-39ukU0n4WiZM_i` | 3 | 200 / 200 |
| What tools does Noah use for AI and LLM development? | `Fvv5H6jDISV8KoPx39Zl8UpO` | 3 | 200 / 200 |

**Required verdicts**

- **Car negative proof — fixed.** The boundary body is the standalone sentence, “I don't have any information about a car I drive.” It does not cite, quote, or contrast an unrelated excerpt to prove absence.
- **3D-printing repetition — not fixed.** Bowiq, CAD, FDM, high-end materials, and machines remain body substance in all three scenes; personal interest is substance in scenes 2 and 3. The timeframe is now confined to scene 1, but the core composite fact still repeats. Representative bodies are “Since 2023 I've been a CAD Designer and 3D Printing Engineer at Bowiq, where my work covers CAD design and FDM 3D printing with high-end materials and machines,” “At Bowiq I do CAD design and FDM 3D printing with high-end materials and machines,” and “At Bowiq, I work with CAD design and FDM 3D printing using high-end materials and machines.”
- **Technical-range breadth — failed.** The story names only two actual projects: LLM Comparison and AI Image Cutout. Bowiq is employment, not a third project, despite the title “Three projects spanning software and hardware.” The opener says, “I built the LLM Comparison app, work as a CAD designer and 3D printing engineer at Bowiq, and created the AI Image Cutout tool.” The corpus had four projects available, so the requested threshold of at least three was missed.

Across the complete sample, substance-level repetition remains. The counting unit is one concrete or composite proposition repeated as body substance in two or more scenes; titles, claims, and brief transitional clauses do not count.

| Story | Count | Repeated body fact sets |
|---|---:|---|
| Car | 2 | AI Image Cutout mechanism and LLM Comparison mechanism both repeat in scenes 2–3. |
| MerchantSpring | 2 | Marketplace-analytics audience and backend/data-pipeline/frontend scope repeat in scenes 1 and 3. |
| Engineering/design | 3 | The bio design fact repeats in scenes 1 and 3; Ask-Me Portfolio and Moodify mechanisms repeat in scenes 2 and 3. |
| 3D printing | 2 | The composite Bowiq/CAD/FDM/high-end-materials/machines fact repeats in all three scenes; personal interest repeats in scenes 2–3. |
| Technical range | 3 | LLM Comparison, Bowiq 3D work, and AI Image Cutout repeat in scenes 1 and 3; Bowiq is also the substance of scene 2. |
| AI/LLM tools | 2 | The five-tool list repeats in scenes 1 and 3; LLM Comparison repeats in scenes 2 and 3. |

The entailment audit treats a standalone boundary absence and synthesis that merely names cited facts as acceptable by design. Date-derived ordering is acceptable only when the scene cites both dated excerpts. Project ownership is acceptable only when a cited excerpt states Noah's role; a project description alone establishes what the project does, not that Noah built it. The AI story no longer says the five tools power the app: its adjacent list and project sentences do not assert a usage relationship.

Unsupported clause occurrences remain:

1. **Car, scene 2 claim:** “I built the AI Image Cutout tool using segment anything, and I also built the open-source LLM Comparison app.”
2. **Car, scenes 2 and 3 bodies:** “I built the AI Image Cutout tool, a fun little app that uses segment anything to cut people and objects out of images to use as stickers.” This unsupported ownership sentence occurs twice.
3. **Car, scene 2 body:** “I also built the open-source LLM Comparison app, which allows users to pit two LLMs against each other and see how they compare.”
4. **Car, scene 3 claim:** “I've built an AI image cutout tool and an LLM comparison app.”
5. **Car, scene 3 body:** “I also built the LLM Comparison app, an open-source project that lets users pit two LLMs against each other and see how they compare.”
6. **MerchantSpring claim:** “Before MerchantSpring, I built data-labeling and AI training-data tooling at Supa and shipped the open-source LLM Comparison app.” Supa ownership is supported, but the scene does not cite the dated MerchantSpring excerpt, so “Before MerchantSpring” is not established by its cited Refs.
7. **MerchantSpring body:** “The marketplace analytics I build at MerchantSpring serve e-commerce sellers and agencies.” The source says the analytics are built *for* those audiences; “serve” upgrades that to an outcome.
8. **3D-printing claim:** “My 3D printing experience combines professional design engineering at Bowiq and a personal passion for the technology.” The excerpts separately establish Bowiq work and being “Into 3D printing / CAD”; they do not state a combined practice, and “passion” strengthens “Into.”
9. **Technical-range claim:** “I built the LLM Comparison app, work as a CAD designer and 3D printing engineer at Bowiq, and created the AI Image Cutout tool.” Neither cited project description states Noah's contribution.
10. **Technical-range body:** “I built the LLM Comparison app, an open-source project that lets you pit two LLMs against each other.” The scene does not cite the Supa career excerpt that states he shipped it.
11. **Technical-range body:** “I also created the AI Image Cutout tool, which uses Segment Anything to cut people and objects out of images for stickers.” The project description states the mechanism but not Noah's role.
12. **AI/LLM-tools claim:** “I use LangChain, Langfuse, Ollama, Hugging Face, and OpenRouter, and I built the LLM Comparison app.” Its scene does not cite the Supa career excerpt that establishes the app contribution.
13. **AI/LLM-tools body:** “I also built the open-source LLM Comparison app, which lets users pit two LLMs against each other and see how they compare.” Its scene likewise cites only the project description for the app.

All other factual claim/body clauses in the final six stories were directly supported by their cited excerpts or fell within the acceptable boundary, adjacency, and synthesis cases above. Overall, Iteration 2 fixes the boundary negative-proof slip and removes the named tools→project usage assertion, but it does not solve cross-scene fact partitioning, technical-range breadth, or project-role grounding. A durable corpus-side fix would add explicit role/contribution lines to `content/about-me/projects/*.md`; that requires a user decision and was not made here.

### Iteration 3 — variable scene counts

The Story contract now accepts one to five scenes and explicitly distinguishes `mode: "grounded"` from `mode: "boundary"`. A Grounded Story requires at least one Evidence Ref on every Scene, including `n=1`. A Boundary Story requires exactly one `direct-answer`/`intro` Scene with no Evidence Refs; redirects live only in Related Questions. Two-scene Stories require `direct-answer` → `synthesis`, `intro` → `resolve`, distinct Patterns, and at least two Registers. Existing three-to-five-scene role, cue, Pattern, Register, and middle-evidence rules remain valid. The compatibility boundary is `v6`.

The behavioral sample used `STORY_CACHE_HMAC_KEY=devsecret`, `STORY_CACHE_HMAC_KEY_ID=dev`, the default OpenRouter model, and freshly restarted development servers. The car question was generated and published again after adding the explicit mode discriminant; it was a cache miss and emitted `mode: "boundary"` with an empty Scene Evidence list and empty Story Evidence vocabulary. The 3D-printing and technical-range rows are the final variable-count samples from the preceding prompt run.

| Question | Published Story | Scenes | Result |
|---|---|---:|---|
| What car does Noah drive? | `6Ih9X4_CaPg8y2yS5lUhxxk2` | 1 | Expected Boundary Story; `mode: "boundary"`, with zero Scene and Story Evidence Refs. |
| What is Noah's experience with 3D printing? | `83OMYkoQVH3VN0fBsY9tpHum` | 1 | Expected thin-evidence shape; one scene cites `career-3` and `fun-fact-1`, so no fact is repeated across scenes. |
| Which projects best show Noah's technical range? | `hzTTdjlEPeLUNPxuAb-3s0m5` | 3 | Expected rich count and breadth; the bodies name Ask-Me Portfolio, LLM Comparison, Moodify, and AI Image Cutout. |

**Verbatim published scene output**

1. **What car does Noah drive?** — 1 scene
   - **“Vehicle Not Shared”**
   - “I have not shared what car I drive.”
2. **What is Noah's experience with 3D printing?** — 1 scene
   - **“3D Printing at Bowiq”**
   - “Since 2023, I've been a CAD Designer & 3D Printing Engineer at Bowiq, focusing on FDM 3D printing with high-end materials and machines. I'm also personally into 3D printing and CAD.”
3. **Which projects best show Noah's technical range?** — 3 scenes
   - **“Ask-Me Portfolio, LLM Comparison, Moodify, AI Image Cutout”**
   - “I created Ask-Me Portfolio, where an LLM composes answers as a JSON spec rendered from a component catalog over a WebGL backdrop. LLM Comparison is an open-source project that lets users pit two LLMs against each other. Moodify searches a favourite tune and uses its album cover's colour palette to recolour the page. AI Image Cutout uses segment anything to cut people and objects out of images to use as stickers.”
   - **“LLM composition, comparison, and dynamic frontends”**
   - “Ask-Me Portfolio is the site you're on right now: an LLM composes answers as a JSON spec rendered from a component catalog over a WebGL shader backdrop. LLM Comparison is an open-source project that pits two LLMs against each other. Moodify lets you search a favourite tune and watch its album cover's palette take over the page — the same palette trick now recolouring this site's hero dither.”
   - **“Across AI, tooling, and creative visuals”**
   - “My portfolio includes the Ask-Me site that uses an LLM to compose answers, an LLM Comparison app that pits two models against each other, an AI Image Cutout tool that uses segment anything to create stickers, and Moodify which recolours the page with an album cover's colour palette.”

The variable-count fix resolves the structural padding in the boundary and 3D-printing cases. The technical-range Story meets the requested three-scene/three-project threshold, but it still repeats project facts across all three bodies. The prompt explicitly requires disjoint fact ownership and forbids this repetition; the model violated that instruction, while the public validator accepted the structurally valid shape because it does not perform semantic entailment or cross-scene proposition comparison.

**UI sanity**

- `JourneyMap` and `NightDrive` already guard every `scenes.length - 1` denominator with `Math.max(1, ...)`.
- The published one-scene car Story rendered its question header, one-item Story rail, direct-answer scene, and related questions. No transition or closing-synthesis scene was rendered. `ClosingSynthesis` is unreachable for `n=1` because validation requires the only role/Pattern to be `direct-answer`/`hero-statement`.
- A zero-Evidence boundary scene hides the per-claim Sources affordance and the footer no longer renders “Grounded in 0 evidence references.”
- Browser verification renders correctly: rail + question prelude/header + single Scene. The one-item rail names “Vehicle Not Shared,” the direct-answer Scene renders its title and body, and Related Questions follow it. The verification screenshot remained a temporary `/tmp` artifact; no binary proof was added to the repository.

Verification: `npx tsc --noEmit` completed cleanly; targeted Story, prompt, generate API, and StoryExperience tests passed; full `npx vitest run` passed 38 files and 285 tests.

## Model shootout — 2026-07-18

The pipeline evaluation ran five Story questions per model through planning, repair, scene composition, and the same validators used by the application. Repetition is the maximum and mean cross-scene body-token Jaccard score per Story; lower is better.

| Model | Plan first-try valid | Plan final valid | Scenes valid | Repetition max | Repetition mean | Banned phrases | Mean story ms | Prompt tokens | Completion tokens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `deepseek/deepseek-v4-flash` | 100% | 100% | 100% | 0.163 | 0.065 | 0 | 67,887 | 45,334 | 31,247 |
| `qwen/qwen3.5-27b` | 60% | 100% | 100% | 0.000 | 0.000 | 0 | 185,908 | 47,026 | 55,949 |
| `openai/gpt-oss-120b` | 60% | 100% | 100% | 0.144 | 0.069 | 1 | 8,298 | 64,975 | 23,272 |
| `mistralai/mistral-small-2603` | 20% | 80% | 100% | 0.122 | 0.033 | 0 | 10,963 | 71,569 | 7,088 |
| `z-ai/glm-5.2` | 80% | 100% | 100% | 0.039 | 0.012 | 0 | 38,930 | 57,631 | 28,190 |
| `z-ai/glm-4.7-flash` | 20% | 80% | 93% | 0.137 | 0.035 | 0 | 231,562 | 62,423 | 51,287 |
| `qwen/qwen3.5-35b-a3b` | 0% | 20% | 67% | 0.017 | 0.006 | 0 | 296,394 | 13,405 | 27,592 |

A blinded review of the three fully viable finalists ranked **C > A > B**, where A was `deepseek/deepseek-v4-flash`, B was `openai/gpt-oss-120b`, and C was `z-ai/glm-5.2`. GLM-5.2 gave the best breadth, naming four distinct projects in the technical-range Story, and had zero entailment violations in the reviewed output. GPT-OSS invented a relationship between Noah's self-hosting and the named project evidence. The license check found GLM-5.2 and DeepSeek V4 Flash under MIT, and GPT-OSS 120B under Apache-2.0.

OpenRouter serves GLM-5.2 through endpoints with different quantization and prices. At the time of review, Novita's fp8 endpoint was $0.2968/$0.9328 per million input/output tokens, while other fp4, fp8, and unreported-quantization endpoints ranged as high as $1.05/$4.40 per million. The shootout used OpenRouter auto-routing, so provider pinning can change quality as well as cost; `OPENROUTER_PROVIDER_ORDER` is therefore an optional preference with fallbacks left enabled, not a default or an `only` restriction.

**Decision:** make `z-ai/glm-5.2` the default. It combined 80% first-try and 100% final plan validity with zero banned phrases, much lower repetition than DeepSeek (0.039 versus 0.163 maximum Jaccard), better blinded-review breadth and entailment, and roughly 39 seconds per Story versus DeepSeek's 68 seconds. Keep auto-routing as the zero-configuration path; operators who prefer a known endpoint may set an ordered provider preference and should rerun `scripts/story-model-eval.ts --pipeline` after pinning.
