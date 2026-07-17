# Code Review — branch `claude/portfolio-website-updates-oe7oxg`

**Date:** 2026-07-15
**Base:** merge-base `0ca0a89a9da5a07fae70cf03f571e53528addab7` → `HEAD`
**Scope:** 127 files, ~16.5k insertions across 7 commits.
**Method:** 7 parallel subsystem reviewers (isolated context each), findings verified against source + repo checks.

## Health baseline (verified)

- `npx tsc --noEmit` → **0 errors, 0 output** (`tsconfig` `strict: true`).
- `npm test` (vitest) → **276/276 pass across 38 files**.

Nothing below is a compile/test break. These are **complexity, code-smell, robustness, and doc** issues. The diff is functionally sound but over-built and over-fragmented.

---

## 1. "Far fewer files" — consolidation map (~11 files removable)

All confirmed against source. No behavior lost.

| Action | Files | Rationale |
|---|---|---|
| Delete | `noah-portfolio/lib/cache/key.ts` + `lib/cache/__tests__/key.test.ts` | `key.ts` is a **pure re-export shim** of `@/lib/story/identity`; only consumer is its own test. `cache/kv.ts` already deleted → whole `lib/cache/` dir disappears. |
| Delete | `noah-portfolio/lib/jsonui/components/_scene-prototype.tsx` (446 ln) + `app/scene-prototype/page.tsx` | `_`-prefixed experimental prototype **wired to a live `/scene-prototype` route in prod**; duplicates StoryExperience scene primitives. |
| Merge | `lib/story/normalize.ts` (4 ln) → into `types.ts`/`identity.ts` | 4-line file; `normalizeQuestion` currently reachable via **3 import paths** (normalize, identity re-export, cache/key). |
| Merge | `lib/story/identity.ts` → into `store.ts` | Collapses once redundant `questionDigest` is removed (§3). |
| Merge | `lib/story/evidence.ts` + `lib/story/projects.server.ts` → one `corpus-vocabulary.server.ts` | Both are server-only corpus-prompt catalogs. |
| Inline | `components/BackdropNocturneScene.tsx` → into `Backdrop.tsx` | Static markup, single consumer. |
| Resolve | `lib/story/migrations/0001_story_records.sql` | **Dead**: schema duplicated in `ensureD1Schema()` and nothing runs the migration. Wire it or delete it — not both. |
| Fold | `app/ask/[storyId]/__tests__/story-fixtures.test.ts` (39 ln) → into `story.test.ts` | Mostly asserts fixtures against themselves / duplicates `toPublicStory` coverage. Also move `story-fixtures.ts` out of the route test dir to `e2e/` or `lib/story/__fixtures__/` (imported by both playwright config and unit tests). |

**Net:** `lib/story/` 9 source files → 5; `lib/cache/` → gone; prototype route gone.

`scripts/motion-intake.mjs` (812 ln) is one-shot intake tooling that currently emits a **schema-invalid** stub (§4) — fix + document it, or move it out of the shipped tree.

---

## 2. Complexity & reusability (highest-value)

1. **Backdrop preset has two owners.** `usePortfolioCanvas.ts` dispatches `setBackdropPreset`/`resetBackdropPreset` at **7 sites** (191, 202, 232, 284, 362, 510, 539) **and** `BackdropSceneSync.tsx` dispatches the same actions declaratively from `[mode, plan]` (19, 24, 29). **Correction (per advisory):** Redux dispatch + React effect ordering here is *deterministic*, not a race. The `resetBackdropPreset()` at `usePortfolioCanvas.ts:284` runs synchronously before the render whose effect later applies `ditherViolet`, so it is a **transient observable write**, not provably-dead code — it may be the intended immediate transition. **Action:** the duplicate ownership is the real issue → make `BackdropSceneSync` the sole owner and strip backdrop-slice coupling from the hook, **but preserve and add a test for the intended immediate transition** when consolidating. This also carves the 737-line hook into a focused story/canvas state machine (biggest single simplification).

2. **NDJSON stream logic duplicated.** `usePortfolioCanvas`'s stream state machine is re-implemented in `OutdatedStory.tsx` (251 ln), incl. a duplicated `samePayload`. Extract a shared `consumeStoryStream()` lib fn, or mount `AskMeProvider` on the outdated branch (deletes an entire fetch-and-publish path; shrinks `OutdatedStory` to presentational JSX).

3. **Validation runs 3×; evidence ~12× per 5-scene story.** `validateCompleteInput` → `makeCandidate` → `parseValidatedRow` each re-run the full Zod schema; `assertCanonicalEvidence` re-parses + `JSON.stringify`s evidence per scene in both `validation.ts` and `public-validation.ts`. Parse evidence once at the record/plan boundary and thread it through. `validationError` helper is duplicated across the two validation modules; slug regex appears 3× in `types.ts`.

4. **`ChatBox` variant duplication (~60 ln parallel JSX)** between default/editorial → collapse with a variant class map. Panel chrome (heading + close) repeats in `AskDock`/`Hero` (minor). Logic is correctly centralized in `ChatBox`; this is JSX-only.

5. **`StoryExperience.tsx` (644 ln) is not a god component** (internally decomposed, 1-level prop drilling) but uses **three reduced-motion approaches**: framer `useReducedMotion`, custom `usePrefersReducedMotion`, raw `window.matchMedia`. Unify on framer's; extract scroll-spy + backdrop-cue effects to local hooks (~60 ln, same file). Un-export `StoryRail`.

---

## 3. Code smells

- **Dead exports:** `STORY_PHASES` (`types.ts:54`), `getCorpusEvidenceRef` (`evidence.ts:85`) — zero references (verified).
- **Dead CSS (~80 ln):** `globals.css` 610–678 targets `data-chapter="intro|contact|stack|career|builds|setup"`, but `BackdropNocturneScene.tsx:6` hardcodes `data-chapter="hero"` → unreachable. Plus 6 duplicate `@keyframes`, and dead `.hero-panel` / `.ask-editorial__route` / `data-reduced-motion` selectors. globals.css grew 504 → 2559 lines.
- **`questionDigest` redundant** — `parseCompatibleRow` already checks normalized `displayQuestion` equality (subsumes digest); `assertValidStoryRecord` re-derives it. Removing it drops a schema field, `identity.ts`'s reason to exist, and 2 checks.
- **`evidenceRefPromptCatalog` is an identity copy** of a strict 4-field schema — `JSON.stringify(CORPUS_EVIDENCE_REFS)` is equivalent.
- **Motion catalog duplicates `public/motion/*.provenance.json`** (license/provenance hand-copied into `catalog.ts`). `localSource` always equals `src`; `staticRendererSchema` duplicates `MOTION_ASSET_IDS`.
- **`motion-intake.mjs` broken/unused:** `catalogStub` emits `localSource: "@/lib/motion-assets/dotlottie/…json"` (violates `/motion/…lottie` schema) and `staticRenderer: "signal-lantern"` (asserted **retired** in `catalog.test.ts`) — can't produce valid output.
- **`ambientLava` preset:** label "Nocturne — Simplex" but retains retired lava name (names persist in stored Stories); calls `ditherFlowPreset()` then overrides most fields — clearer as a literal or options arg.
- **`'ditherViolet'` magic string** (`BackdropSceneSync:29`) works only because the slice silently no-ops unknown names — use a typed constant.
- **Prod store carries Playwright fixture-loading** — move to a test-only seeding helper called from playwright global setup.

---

## 4. Typings — sound, but loose in places

Baseline good (`strict: true`, clean `tsc`, green tests). `noUncheckedIndexedAccess` is **off**, which is why the array cases below compile.

- **`StoryPhase` defined twice, identically** — `usePortfolioCanvas.ts:29` and `StoryExperience.tsx:16`. Move to `lib/story/types.ts`.
- **`catalogInputs: Record<MotionAssetId, unknown>`** (`catalog.ts:258`) + `.parse()` + `as Record<…>`. Type as `z.input<typeof motionAssetRecordSchema>` for author-time safety.
- **`BackdropPalette.colors: string[]`** (`presets.ts:33`) and **`RgbTuple` = `number[]`** — dithering reads `colors[0]` / destructures 3 elements with no non-empty/tuple guarantee. Make `RgbTuple = [number, number, number]`.
- **Unsafe intersection cast** in `MotionAsset.tsx` on DotLottie asset props — narrow the union.
- **`vitest.setup.ts`** IntersectionObserver stub via `as unknown as Record<string, unknown>` (acceptable; a typed minimal stub is cleaner).
- **`env.ts` guard too permissive** (robustness/security): falls back to the constant dev HMAC key unless env is *explicitly* production — a self-hosted **staging** deploy silently uses the known dev key. Reject anything not dev/test. `getStoryCacheHmacKeyId`'s `injected` param is unused API surface.
- **`lockedFields`** (`public-validation.ts`) hand-maintained against `ScenePlan` keys — derive from schema shape so new fields can't skip lock-checking. Stream-event evidence array has a min but no max bound (enforced elsewhere).
- Scattered non-null assertions in fixtures and the memory-row lookup — tighten via a properly-typed `Map`.

---

## 5. Docs & one logic risk

- **`docs/design-contract.md` (514 ln, "Accepted") partly contradicts shipped code.** §3/11/12 match (plan-first, progressive delivery, versioned identity); **§5, §7, §8.2, §8.3, §15 are aspirational/contradictory** with no per-section status markers. Trim to shipped (7-pattern catalog) or mark the rest "roadmap".
- **Stale template:** `.env.local.example` is correct (D1 + HMAC), but the repo setup script still generates the old `CF_KV` template.
- **Logic risk (medium — needs specific scenario):** published rows use `expires_at=0` with **no delete path**; if `STORY_CACHE_HMAC_KEY_ID` is rotated *without* the matching key, `store.ts:442` (`claimed.hmac_key_id !== hmacKeyId`) throws "revalidation failed" permanently, blocking regeneration for that question. Either include `hmacKeyId` in the cache-identity payload, or let the UPSERT take over key-mismatched rows.

---

## TODO checklist

### P1 — complexity & duplication (maintainer's top concern)
- [ ] Make `BackdropSceneSync` the sole backdrop-preset owner; strip the 7 backdrop dispatches from `usePortfolioCanvas.ts`. **Preserve + test the intended immediate transition** (the `ditherViolet` reset→set sequence is deterministic, not a race — don't drop the transient write blindly).
- [ ] De-duplicate the NDJSON stream state machine between `usePortfolioCanvas.ts` and `OutdatedStory.tsx` (shared `consumeStoryStream()` or mount `AskMeProvider` on the outdated branch). Remove duplicated `samePayload`.
- [ ] Parse evidence once at the record/plan boundary; stop the triple `validateCompleteInput`/`makeCandidate`/`parseValidatedRow` re-validation. De-dup `validationError`.
- [ ] Collapse `ChatBox` default/editorial variant JSX (~60 ln) via a variant class map.

### P1 — file-count reduction
- [ ] Delete `lib/cache/key.ts` + `lib/cache/__tests__/key.test.ts` (move any unique test assertions into story tests).
- [ ] Delete `_scene-prototype.tsx` + `app/scene-prototype/page.tsx` (or promote out of `_` and off the prod route if intentionally kept).
- [ ] Merge `lib/story/normalize.ts` → `types.ts`/`identity.ts`; remove the 3rd `normalizeQuestion` import path.
- [ ] Remove redundant `questionDigest`, then merge `identity.ts` → `store.ts`.
- [ ] Merge `evidence.ts` + `projects.server.ts` → `corpus-vocabulary.server.ts`.
- [ ] Inline `BackdropNocturneScene.tsx` → `Backdrop.tsx`.
- [ ] Resolve `migrations/0001_story_records.sql` (wire the migration runner, or delete + keep `ensureD1Schema`).
- [ ] Fold `story-fixtures.test.ts` into `story.test.ts`; relocate `story-fixtures.ts` out of the route test dir.

### P2 — smells & dead code
- [ ] Delete dead exports `STORY_PHASES`, `getCorpusEvidenceRef`.
- [ ] Delete ~80 ln dead `data-chapter` CSS (globals.css 610–678) + 6 duplicate `@keyframes` + dead `.hero-panel` / `.ask-editorial__route` / `data-reduced-motion` (or reintroduce the chapter driver if the animation was intended).
- [ ] Derive motion catalog provenance/license from `*.provenance.json`; drop redundant `localSource`; dedupe `staticRendererSchema` vs `MOTION_ASSET_IDS`.
- [ ] Fix or remove `scripts/motion-intake.mjs` (emits schema-invalid stub).
- [ ] Rename/comment `ambientLava` (label vs retired name); clean the `ditherFlowPreset` override.
- [ ] Replace `'ditherViolet'` magic string with a typed constant.
- [ ] Move Playwright fixture-loading out of prod `store.ts` into a test-only seeding helper.
- [ ] Replace `evidenceRefPromptCatalog` identity copy.

### P2 — typings
- [ ] Move `StoryPhase` to `lib/story/types.ts`; remove the duplicate definition.
- [ ] Type `catalogInputs` as `z.input<typeof motionAssetRecordSchema>`.
- [ ] Make `RgbTuple = [number, number, number]`; tighten `BackdropPalette.colors` (non-empty guarantee).
- [ ] Narrow the DotLottie intersection cast in `MotionAsset.tsx`.
- [ ] Tighten `env.ts` environment guard (reject non-dev/test fallback to the constant key); drop unused `injected` param.
- [ ] Derive `lockedFields` from the schema shape; add max bound to stream-event evidence array.
- [ ] Remove scattered non-null assertions (fixtures, memory-row lookup) via typed `Map`.

### P2 — docs & logic
- [ ] Reconcile `docs/design-contract.md` with shipped code (mark or trim §5/§7/§8.2/§8.3/§15).
- [ ] Fix the setup script's stale `CF_KV` env template.
- [ ] Decide on the D1 key-rotation edge case (`store.ts:442`): include `hmacKeyId` in cache identity, or let UPSERT take over key-mismatched published rows.

---

*Findings verified against source at review time; re-confirm line numbers before editing (the branch may have moved).*
