import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CORPUS_EVIDENCE_REFS,
  UnknownProjectSlugError,
  resolveStoryProjects,
} from "@/lib/story/evidence";
import {
  assertValidPublicStory,
  assertValidStreamPlan,
  assertValidStreamScene,
} from "@/lib/story/public-validation";
import {
  __resetStoryStoreForTests,
  findCurrentStory,
  findPreparedStory,
  prepareCompleteStory,
  publishPreparedStory,
  resolveStory,
  seedStoryFixtures,
  storyCacheIdentity,
} from "@/lib/story/store";
import {
  CORPUS_REVISION,
  MAX_STORY_QUESTION_LENGTH,
  STORY_CONTRACT_VERSION,
  PublicStorySchema,
  StoryStreamEventSchema,
  StoryQuestionSchema,
  normalizeQuestion,
  toPublicStory,
  type NewStoryRecord,
  type StoryPlan,
  type StoryRecord,
} from "@/lib/story/types";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_STORY_RECORD,
  OUTDATED_STORY_RECORD,
  PLAYWRIGHT_STORY_RECORDS,
  RELATED_PUBLIC_STORY,
} from "@/lib/story/__fixtures__/story-fixtures";
import {
  assertValidStoryPlan,
  assertValidStoryRecord,
  assertValidStoryScene,
} from "@/lib/story/validation";

const evidence = CORPUS_EVIDENCE_REFS.slice(0, 3);
const DEFAULT_QUESTION = "How does Noah approach complex products?";

function makePlan(question = DEFAULT_QUESTION): StoryPlan {
  return {
    question,
    mode: "grounded",
    backdropPreset: "ambientLava",
    scenes: [
      {
        id: "direct-answer",
        index: 0,
        role: "direct-answer",
        pattern: "hero-statement",
        register: "editorial",
        title: "A direct answer",
        claim: "Noah combines product judgment with systems engineering.",
        assetId: "circuit-mind",
        evidenceRefIds: [evidence[0].id],
        cue: { phase: "intro", focus: "center", intensity: "quiet" },
      },
      {
        id: "grounded-evidence",
        index: 1,
        role: "evidence",
        pattern: "evidence-ledger",
        register: "technical",
        title: "The evidence",
        claim: "His authored profile grounds that combination in concrete work.",
        assetId: "print-layers",
        evidenceRefIds: [evidence[1].id, evidence[2].id],
        projectSlugs: ["ask-me-portfolio", "llm-comparison"],
        cue: { phase: "develop", focus: "left", intensity: "strong" },
      },
      {
        id: "tailored-synthesis",
        index: 2,
        role: "synthesis",
        pattern: "closing-synthesis",
        register: "reflective",
        title: "What that means",
        claim: "The result is technical work made useful and understandable.",
        assetId: "morning-coffee",
        evidenceRefIds: [evidence[0].id, evidence[2].id],
        projectSlugs: ["moodify"],
        cue: { phase: "resolve", focus: "right", intensity: "medium" },
      },
    ],
    relatedQuestions: [
      "Which projects best show that approach?",
      "How does Noah work across product and engineering?",
    ],
  };
}

function makeSingleScenePlan(question = DEFAULT_QUESTION): StoryPlan {
  const plan = makePlan(question);
  return { ...plan, scenes: [plan.scenes[0]] };
}

function makeTwoScenePlan(question = DEFAULT_QUESTION): StoryPlan {
  const plan = makePlan(question);
  return {
    ...plan,
    scenes: [
      plan.scenes[0],
      {
        ...plan.scenes[2],
        id: "two-scene-synthesis",
        index: 1,
        evidenceRefIds: [evidence[2].id],
      },
    ],
  };
}

function makeInput(displayQuestion = DEFAULT_QUESTION): NewStoryRecord {
  const plan = makePlan(displayQuestion);
  return {
    displayQuestion,
    plan,
    scenes: plan.scenes.map((scene) => ({
      ...scene,
      body: `${scene.claim} This Scene explains the claim using its cited Corpus evidence.`,
      ...(scene.projectSlugs
        ? { projects: resolveStoryProjects(scene.projectSlugs) }
        : {}),
    })),
    evidence: evidence.map((ref) => ({ ...ref })),
  };
}

async function storePublishedStory(
  input: NewStoryRecord,
  options: { signal?: AbortSignal } = {},
): Promise<StoryRecord> {
  const prepared = await prepareCompleteStory(input, options);
  return publishPreparedStory(prepared.publicationToken, options);
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("STORY_CACHE_HMAC_KEY", "focused-test-story-secret");
  vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "focused-v1");
  vi.stubEnv("CF_ACCOUNT_ID", "");
  vi.stubEnv("CF_D1_DATABASE_ID", "");
  vi.stubEnv("CF_D1_TOKEN", "");
  vi.stubEnv("PLAYWRIGHT_TEST_MODE", "");
  __resetStoryStoreForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Story validation", () => {
  it("accepts the complete richness contract", () => {
    const plan = makePlan();
    expect(() => assertValidStoryPlan(plan, evidence, plan.question)).not.toThrow();
    expect(plan.scenes).toHaveLength(3);
    expect(new Set(plan.scenes.map((scene) => scene.pattern)).size).toBe(3);
    expect(new Set(plan.scenes.map((scene) => scene.register)).size).toBeGreaterThanOrEqual(2);
    expect(plan.scenes[1].evidenceRefIds).toHaveLength(2);
  });

  it("accepts grounded one- and two-scene Plans plus an uncited one-scene Boundary Story", () => {
    const single = makeSingleScenePlan();
    const unsupportedBoundary = makeSingleScenePlan();
    unsupportedBoundary.mode = "boundary";
    unsupportedBoundary.scenes[0].evidenceRefIds = [];
    const pair = makeTwoScenePlan();

    expect(() => assertValidStoryPlan(single, evidence, single.question)).not.toThrow();
    expect(() => assertValidStoryPlan(unsupportedBoundary, [], unsupportedBoundary.question)).not.toThrow();
    expect(() => assertValidStreamPlan(unsupportedBoundary, [], unsupportedBoundary.question)).not.toThrow();
    expect(() => StoryStreamEventSchema.parse({
      type: "plan",
      plan: unsupportedBoundary,
      evidence: [],
    })).not.toThrow();
    expect(() => assertValidStoryPlan(pair, evidence, pair.question)).not.toThrow();
    expect(single.scenes.map((scene) => [scene.role, scene.cue.phase])).toEqual([
      ["direct-answer", "intro"],
    ]);
    expect(pair.scenes.map((scene) => [scene.role, scene.cue.phase])).toEqual([
      ["direct-answer", "intro"],
      ["synthesis", "resolve"],
    ]);
  });

  it("rejects role, cue, and Register violations in short Plans", () => {
    const wrongSingleCue = makeSingleScenePlan();
    wrongSingleCue.scenes[0].cue.phase = "resolve";
    expect(() =>
      assertValidStoryPlan(wrongSingleCue, evidence, wrongSingleCue.question)
    ).toThrow(/cue phase must be intro/);

    const evidenceEnding = makeTwoScenePlan();
    evidenceEnding.scenes[1] = {
      ...makePlan().scenes[1],
      index: 1,
    };
    expect(() =>
      assertValidStoryPlan(evidenceEnding, evidence, evidenceEnding.question)
    ).toThrow(/Scene 1 must have role synthesis/);

    const oneRegister = makeTwoScenePlan();
    oneRegister.scenes[1].register = oneRegister.scenes[0].register;
    expect(() =>
      assertValidStoryPlan(oneRegister, evidence, oneRegister.question)
    ).toThrow(/at least two Registers/);

    const groundedWithoutEvidence = makeSingleScenePlan();
    groundedWithoutEvidence.scenes[0].evidenceRefIds = [];
    expect(() =>
      assertValidStoryPlan(groundedWithoutEvidence, [], groundedWithoutEvidence.question)
    ).toThrow(/grounded mode requires at least one Evidence Ref/);

    const citedBoundary = makeSingleScenePlan();
    const boundaryWithUnrelatedVocabulary = makeSingleScenePlan();
    boundaryWithUnrelatedVocabulary.mode = "boundary";
    boundaryWithUnrelatedVocabulary.scenes[0].evidenceRefIds = [];
    expect(() =>
      assertValidStreamPlan(
        boundaryWithUnrelatedVocabulary,
        evidence,
        boundaryWithUnrelatedVocabulary.question,
      )
    ).toThrow(/boundary mode must not include an Evidence vocabulary/);

    citedBoundary.mode = "boundary";
    expect(() =>
      assertValidStoryPlan(citedBoundary, evidence, citedBoundary.question)
    ).toThrow(/boundary mode must not include Evidence Refs/);

    const multiSceneBoundary = makeTwoScenePlan();
    multiSceneBoundary.mode = "boundary";
    expect(() =>
      assertValidStoryPlan(multiSceneBoundary, evidence, multiSceneBoundary.question)
    ).toThrow(/boundary mode requires exactly one Scene/);

    const missingEvidence = makeTwoScenePlan();
    missingEvidence.scenes[1].evidenceRefIds = [];
    expect(() =>
      assertValidStoryPlan(missingEvidence, evidence, missingEvidence.question)
    ).toThrow(/grounded mode requires at least one Evidence Ref/);
  });

  it("uses one trimmed 280-character Question contract for display and related questions", async () => {
    const boundary = "q".repeat(MAX_STORY_QUESTION_LENGTH);
    expect(StoryQuestionSchema.parse(`  ${boundary}  `)).toBe(boundary);
    expect(StoryQuestionSchema.safeParse("   ").success).toBe(false);
    expect(StoryQuestionSchema.safeParse(`${boundary}q`).success).toBe(false);

    const longRelated = structuredClone(makePlan());
    longRelated.relatedQuestions[0] = `${boundary}q`;
    expect(() => assertValidStoryPlan(longRelated, evidence, longRelated.question)).toThrow(/at most 280 characters/);

    await expect(storePublishedStory(makeInput(`${boundary}q`))).rejects.toThrow(
      /at most 280 characters/,
    );
  });

  it("binds the locked Plan question to the expected display question", async () => {
    const plan = makePlan();
    expect(() =>
      assertValidStoryPlan(plan, evidence, "Which unrelated question was asked?"),
    ).toThrow(/question differs from the expected display question/);

    const input = makeInput();
    input.plan.question = "Which unrelated question was asked?";
    await expect(storePublishedStory(input)).rejects.toThrow(
      /question differs from the expected display question/,
    );
  });

  it("rejects ordering, role-pattern, cue, and richness violations deterministically", () => {
    const unordered = structuredClone(makePlan());
    unordered.scenes[1].index = 2;
    expect(() => assertValidStoryPlan(unordered, evidence, unordered.question)).toThrow(/index 2 must be 1/);

    const repeatedPattern = structuredClone(makePlan());
    repeatedPattern.scenes[1].pattern = "hero-statement";
    expect(() => assertValidStoryPlan(repeatedPattern, evidence, repeatedPattern.question)).toThrow(/Patterns must be unique|not eligible/);

    const wrongCue = structuredClone(makePlan());
    wrongCue.scenes[2].cue.phase = "develop";
    expect(() => assertValidStoryPlan(wrongCue, evidence, wrongCue.question)).toThrow(/cue phase must be resolve/);

    const oneRegister = structuredClone(makePlan());
    oneRegister.scenes.forEach((scene) => { scene.register = "editorial"; });
    expect(() => assertValidStoryPlan(oneRegister, evidence, oneRegister.question)).toThrow(/at least two Registers/);
  });

  it("locks every composed Scene field to its validated plan", () => {
    const input = makeInput();
    expect(() => assertValidStoryScene(input.scenes[0], input.plan.scenes[0], input.evidence)).not.toThrow();

    const changedClaim = structuredClone(input.scenes[0]);
    changedClaim.claim = "A different unsupported claim";
    expect(() => assertValidStoryScene(changedClaim, input.plan.scenes[0], input.evidence)).toThrow(
      /claim differs from the locked Story Plan/,
    );

    const changedProjects = structuredClone(input.scenes[1]);
    changedProjects.projectSlugs = ["ai-image-cutout"];
    changedProjects.projects = resolveStoryProjects(changedProjects.projectSlugs);
    expect(() =>
      assertValidStoryScene(changedProjects, input.plan.scenes[1], input.evidence),
    ).toThrow(/projectSlugs differs from the locked Story Plan/);
  });


  it("rejects unknown, unsafe, and pattern-ineligible Motion Asset selections", () => {
    const unknown = structuredClone(makePlan());
    unknown.scenes[0].assetId = "unreviewed-remote-animation" as never;
    expect(() => assertValidStoryPlan(unknown, evidence, unknown.question)).toThrow(/Unknown Motion Asset ID/);

    const unsafe = structuredClone(makePlan()) as StoryPlan & {
      scenes: Array<StoryPlan["scenes"][number] & { src?: string }>;
    };
    unsafe.scenes[0].src = "https://untrusted.example/animation.svg";
    expect(() => assertValidStoryPlan(unsafe, evidence, unsafe.question)).toThrow(/Unrecognized key.*src/);

    const mismatched = structuredClone(makePlan());
    mismatched.scenes[1].assetId = "circuit-mind";
    expect(() => assertValidStoryPlan(mismatched, evidence, mismatched.question)).toThrow(/not eligible for pattern evidence-ledger/);
  });

  it("rejects decorative or generator-ineligible focal assets in Plans and Scenes", () => {
    const decorativePlan = structuredClone(makePlan());
    decorativePlan.scenes[2].assetId = "spark-loader";
    expect(() => assertValidStoryPlan(decorativePlan, evidence, decorativePlan.question)).toThrow(/generator-eligible|meaningful/);

    const input = makeInput();
    const locked = { ...input.plan.scenes[2], assetId: "spark-loader" as const };
    const scene = { ...input.scenes[2], assetId: "spark-loader" as const };
    expect(() => assertValidStoryScene(scene, locked, input.evidence)).toThrow(
      /generator-eligible|meaningful/,
    );
  });

  it("rejects invented, duplicate, unlocked, and mismatched project references", () => {
    const unknownPlan = structuredClone(makePlan());
    unknownPlan.scenes[1].projectSlugs = ["invented-project" as never];
    expect(() =>
      assertValidStoryPlan(unknownPlan, evidence, unknownPlan.question),
    ).toThrow(UnknownProjectSlugError);
    expect(() =>
      assertValidStreamPlan(unknownPlan, evidence, unknownPlan.question),
    ).toThrow(/Unknown Corpus project slug/);

    const duplicatePlan = structuredClone(makePlan());
    duplicatePlan.scenes[1].projectSlugs = ["moodify", "moodify"];
    expect(() =>
      assertValidStoryPlan(duplicatePlan, evidence, duplicatePlan.question),
    ).toThrow(/Project slugs must be unique/);

    const input = makeInput();
    const inventedScene = structuredClone(input.scenes[1]);
    inventedScene.projectSlugs = ["invented-project" as never];
    expect(() =>
      assertValidStreamScene(inventedScene, input.plan.scenes[1], input.evidence),
    ).toThrow(/Unknown Corpus project slug/);
    expect(() =>
      assertValidStoryScene(inventedScene, input.plan.scenes[1], input.evidence),
    ).toThrow(/Unknown Corpus project slug/);

    const reorderedCards = structuredClone(input.scenes[1]);
    reorderedCards.projects?.reverse();
    expect(() =>
      assertValidStreamScene(reorderedCards, input.plan.scenes[1], input.evidence),
    ).toThrow(/projects must correspond exactly/);

    const modifiedCard = structuredClone(input.scenes[1]);
    modifiedCard.projects![0].title = "Model-authored title";
    expect(() =>
      assertValidStreamScene(modifiedCard, input.plan.scenes[1], input.evidence),
    ).not.toThrow();
    expect(() =>
      assertValidStoryScene(modifiedCard, input.plan.scenes[1], input.evidence),
    ).toThrow(/projects must exactly match/);
  });

  it("rejects fabricated or modified Evidence Refs outside the Corpus vocabulary", () => {
    const changedEvidence = evidence.map((ref) => ({ ...ref }));
    changedEvidence[0].excerpt = "A model-authored replacement";
    const plan = makePlan();
    expect(() => assertValidStoryPlan(plan, changedEvidence, plan.question)).toThrow(/active Corpus vocabulary/);
  });
});

describe("public Story browser fixtures", () => {
  it("keeps seeded records valid and public projections free of compatibility metadata", () => {
    for (const record of PLAYWRIGHT_STORY_RECORDS) {
      expect(() => assertValidStoryRecord(record)).not.toThrow();
    }
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("questionDigest");
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("corpusRevision");
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("storyContractVersion");
    expect(RELATED_PUBLIC_STORY).not.toHaveProperty("questionDigest");
    expect(CURRENT_PUBLIC_STORY.id).toBe(CURRENT_STORY_RECORD.id);
    expect(OUTDATED_STORY_RECORD.scenes.some((scene) => scene.body.includes("STALE"))).toBe(true);
  });
});

describe("Story persistence and resolution", () => {
  it("rejects partial input, hides prepared rows, and publishes idempotently", async () => {
    const partial = makeInput() as NewStoryRecord & { scenes: NewStoryRecord["scenes"] };
    partial.scenes = partial.scenes.slice(0, 2);
    await expect(prepareCompleteStory(partial)).rejects.toThrow(/Invalid complete Story input|Scene count/);

    const prepared = await prepareCompleteStory(makeInput());
    expect(() => assertValidStoryRecord(prepared.story)).not.toThrow();
    await expect(findCurrentStory(prepared.story.displayQuestion)).resolves.toBeNull();
    await expect(resolveStory(prepared.story.id)).resolves.toEqual({ status: "missing" });

    const published = await publishPreparedStory(prepared.publicationToken);
    await expect(resolveStory(published.id)).resolves.toEqual({ status: "current", story: published });
    await expect(publishPreparedStory(prepared.publicationToken)).resolves.toEqual(published);
  });

  it("atomically reuses one pending ID for concurrent equivalent prepares", async () => {
    const [first, concurrent] = await Promise.all([
      prepareCompleteStory(makeInput("  HOW   does Noah approach complex products?  ")),
      prepareCompleteStory(makeInput("how does noah approach complex products?")),
    ]);

    expect(concurrent.story.id).toBe(first.story.id);
    expect(concurrent.story).toEqual(first.story);
    expect(concurrent.publicationToken).toBe(first.publicationToken);
    await expect(findCurrentStory(DEFAULT_QUESTION)).resolves.toBeNull();
    const published = await publishPreparedStory(first.publicationToken);
    await expect(publishPreparedStory(concurrent.publicationToken)).resolves.toEqual(published);
    expect((await findCurrentStory(DEFAULT_QUESTION))?.id).toBe(first.story.id);
  });

  it("generates independently random opaque IDs rather than exposing cache identity", async () => {
    const first = await storePublishedStory(makeInput("What has Noah built?"));
    const second = await storePublishedStory(makeInput("How does Noah work?"));

    expect(first.id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(second.id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(second.id).not.toBe(first.id);
    expect(first.id).not.toBe(storyCacheIdentity(first.displayQuestion, { secret: "focused-test-story-secret" }));
    expect(first.id).not.toContain("what");
  });

  it("normalizes equivalent questions and versions private cache identities", () => {
    const secret = "identity-test-secret-one";
    const question = "What Projects Has Noah Built?";
    const identity = storyCacheIdentity(question, { secret });

    expect(normalizeQuestion("  What  Does Noah DO? ")).toBe("what does noah do?");
    expect(normalizeQuestion("ＡＳＫ\tNOAH")).toBe("ask noah");
    expect(identity).toBe(
      storyCacheIdentity("  what   projects has noah built?  ", { secret }),
    );
    expect(identity).toMatch(/^[a-f0-9]{64}$/);
    expect(identity).not.toContain(question);
    expect(identity).not.toContain(normalizeQuestion(question));
    expect(storyCacheIdentity(question, { secret: "identity-test-secret-two" })).not.toBe(identity);
    expect(storyCacheIdentity(question, {
      secret,
      corpusRevision: `${CORPUS_REVISION}-next`,
    })).not.toBe(identity);
    expect(storyCacheIdentity(question, {
      secret,
      storyContractVersion: `${STORY_CONTRACT_VERSION}-next`,
    })).not.toBe(identity);
  });

  it.each([
    {
      label: "exact current",
      corpusRevision: CORPUS_REVISION,
      storyContractVersion: STORY_CONTRACT_VERSION,
      rotateKeyId: false,
      expectedStatus: "current",
    },
    {
      label: "Corpus-only mismatch",
      corpusRevision: "retired-corpus",
      storyContractVersion: STORY_CONTRACT_VERSION,
      rotateKeyId: false,
      expectedStatus: "outdated",
    },
    {
      label: "Story-Contract-only mismatch",
      corpusRevision: CORPUS_REVISION,
      storyContractVersion: "v2",
      rotateKeyId: false,
      expectedStatus: "outdated",
    },
    {
      label: "key-ID-only rotation",
      corpusRevision: CORPUS_REVISION,
      storyContractVersion: STORY_CONTRACT_VERSION,
      rotateKeyId: true,
      expectedStatus: "outdated",
    },
    {
      label: "Corpus and Story-Contract mismatch",
      corpusRevision: "retired-corpus",
      storyContractVersion: "v2",
      rotateKeyId: false,
      expectedStatus: "outdated",
    },
  ] as const)("resolves $label without exposing stale Scenes", async (variant) => {
    const base = await storePublishedStory(makeInput());
    __resetStoryStoreForTests();
    const fixture: StoryRecord = {
      ...base,
      corpusRevision: variant.corpusRevision,
      storyContractVersion: variant.storyContractVersion,
    };
    seedStoryFixtures([fixture]);
    if (variant.rotateKeyId) vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "focused-v2");

    const result = await resolveStory(fixture.id);
    if (variant.expectedStatus === "current") {
      expect(result).toEqual({ status: "current", story: fixture });
    } else {
      expect(result).toEqual({
        status: "outdated",
        id: fixture.id,
        displayQuestion: fixture.displayQuestion,
        corpusRevision: fixture.corpusRevision,
        storyContractVersion: fixture.storyContractVersion,
      });
      expect(result).not.toHaveProperty("story");
      expect(result).not.toHaveProperty("scenes");
    }
  });

  it("distinguishes missing opaque IDs", async () => {
    await expect(resolveStory("Z9wE3rT7_yU1iO5pS8dF2gH4")).resolves.toEqual({ status: "missing" });
  });


  it("rejects malformed fixture records and duplicate fixture cache identities", async () => {
    expect(() => seedStoryFixtures([{
      id: "A9wE3rT7_yU1iO5pS8dF2gH4",
      displayQuestion: DEFAULT_QUESTION,
    }])).toThrow(/Invalid Story fixtures/);

    const base = await storePublishedStory(makeInput());
    __resetStoryStoreForTests();
    const duplicate = { ...base, id: "A9wE3rT7_yU1iO5pS8dF2gH4" };
    expect(() => seedStoryFixtures([base, duplicate])).toThrow(/duplicate cache identity/);
  });

  it("lets a key-ID rotation replace a published identity with a new current Story", async () => {
    const old = await storePublishedStory(makeInput());
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "focused-v2");

    const oldResolution = await resolveStory(old.id);
    expect(oldResolution).toMatchObject({
      status: "outdated",
      id: old.id,
      displayQuestion: old.displayQuestion,
    });
    await expect(findCurrentStory(old.displayQuestion)).resolves.toBeNull();
    const regenerated = await storePublishedStory(makeInput());
    expect(regenerated.id).not.toBe(old.id);
    await expect(findCurrentStory(old.displayQuestion)).resolves.toEqual(regenerated);
  });

  it("fails closed when production Story storage has no D1 configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "");
    vi.stubEnv("STORY_CACHE_HMAC_KEY", "p".repeat(32));
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "production-v1");
    await expect(findCurrentStory("How does Noah work?")).rejects.toThrow(/D1 Story storage is required/);
  });

  it("uses the D1 REST query endpoint for atomic UPSERT and public-ID resolution", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "");
    vi.stubEnv("CF_ACCOUNT_ID", "account-id");
    vi.stubEnv("CF_D1_DATABASE_ID", "database-id");
    vi.stubEnv("CF_D1_TOKEN", "d1-token");
    vi.stubEnv("STORY_CACHE_HMAC_KEY", "d".repeat(32));
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "d1-test-v1");

    let storedRow: Record<string, string | number> | undefined;
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        sql: string;
        params: Array<string | number>;
      };
      let results: Array<Record<string, string | number>> = [];
      if (request.sql.startsWith("INSERT INTO story_records")) {
        storedRow = {
          public_id: request.params[0],
          cache_identity: request.params[1],
          hmac_key_id: request.params[2],
          record_json: request.params[3],
          published: 0,
          expires_at: Math.floor(Date.now() / 1000) + Number(request.params[4]),
        };
        results = [storedRow];
      } else if (request.sql.startsWith("UPDATE story_records") && storedRow) {
        storedRow.published = 1;
        storedRow.expires_at = 0;
        results = [storedRow];
      } else if (request.sql.startsWith("SELECT")) {
        results = storedRow ? [storedRow] : [];
      }
      return new Response(JSON.stringify({
        success: true,
        result: [{ success: true, results }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const stored = await storePublishedStory(makeInput());
    await expect(resolveStory(stored.id)).resolves.toEqual({ status: "current", story: stored });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const [upsertUrl, upsertInit] = fetchMock.mock.calls[1];
    const upsert = JSON.parse(String(upsertInit?.body)) as {
      sql: string;
      params: Array<string | number>;
    };
    expect(String(upsertUrl)).toContain("/accounts/account-id/d1/database/database-id/query");
    expect(upsert.sql).toContain("ON CONFLICT(cache_identity)");
    expect(upsert.sql).toContain("RETURNING public_id");
    expect(upsert.sql).toContain("hmac_key_id <> excluded.hmac_key_id");
    expect(String(upsert.params[1])).toMatch(/^[a-f0-9]{64}$/);
    expect(String(upsert.params[1])).not.toContain("how does noah");
  });

  it("keeps an aborted prepared Story unresolvable and out of current cache", async () => {
    const prepared = await prepareCompleteStory(makeInput());
    const controller = new AbortController();
    controller.abort();
    await expect(
      publishPreparedStory(prepared.publicationToken, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    await expect(resolveStory(prepared.story.id)).resolves.toEqual({ status: "missing" });
    await expect(findCurrentStory(prepared.story.displayQuestion)).resolves.toBeNull();
    await expect(findPreparedStory(prepared.story.displayQuestion)).resolves.toEqual(prepared);
  });

  it("rejects invalid and expired publication tokens and replaces expired pending rows", async () => {
    const prepared = await prepareCompleteStory(makeInput());
    const invalidToken = `${prepared.story.id}.${"A".repeat(43)}`;
    await expect(publishPreparedStory(invalidToken)).rejects.toThrow(/token signature/);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    await expect(publishPreparedStory(prepared.publicationToken)).rejects.toThrow(/expired/);
    await expect(findPreparedStory(prepared.story.displayQuestion)).resolves.toBeNull();
    const replacement = await prepareCompleteStory(makeInput());
    expect(replacement.story.id).not.toBe(prepared.story.id);
    await expect(resolveStory(prepared.story.id)).resolves.toEqual({ status: "missing" });
  });

  it("strips compatibility metadata from every public event", async () => {
    const record = await storePublishedStory(makeInput());
    const publicStory = toPublicStory(record);

    expect(publicStory).not.toHaveProperty("questionDigest");
    expect(publicStory).not.toHaveProperty("corpusRevision");
    expect(publicStory).not.toHaveProperty("storyContractVersion");
    expect(StoryStreamEventSchema.parse({ type: "complete", story: publicStory })).toEqual({
      type: "complete",
      story: publicStory,
    });
    expect(StoryStreamEventSchema.safeParse({ type: "complete", story: record }).success).toBe(false);
    expect(record.corpusRevision).toBe(CORPUS_REVISION);
    expect(record.storyContractVersion).toBe(STORY_CONTRACT_VERSION);
  });

  it("rejects schema-valid Public Stories that violate shared semantic invariants", async () => {
    const publicStory = toPublicStory(await storePublishedStory(makeInput()));

    const repeatedPattern = structuredClone(publicStory);
    repeatedPattern.plan.scenes[1].pattern = "hero-statement";
    repeatedPattern.scenes[1].pattern = "hero-statement";
    expect(PublicStorySchema.safeParse(repeatedPattern).success).toBe(true);
    expect(() => assertValidPublicStory(repeatedPattern)).toThrow(/Scene Patterns must be unique/);

    const duplicateEvidence = structuredClone(publicStory);
    duplicateEvidence.evidence.push({ ...duplicateEvidence.evidence[0] });
    expect(PublicStorySchema.safeParse(duplicateEvidence).success).toBe(true);
    expect(() => assertValidPublicStory(duplicateEvidence)).toThrow(/duplicate ID/);

    const unknownSceneEvidence = structuredClone(publicStory);
    unknownSceneEvidence.plan.scenes[0].evidenceRefIds = ["unknown-evidence"];
    unknownSceneEvidence.scenes[0].evidenceRefIds = ["unknown-evidence"];
    expect(PublicStorySchema.safeParse(unknownSceneEvidence).success).toBe(true);
    expect(() => assertValidPublicStory(unknownSceneEvidence)).toThrow(/unknown Evidence Ref ID/);

    const unlockedScene = structuredClone(publicStory);
    unlockedScene.scenes[1].claim = "A schema-valid but unlocked replacement claim.";
    expect(PublicStorySchema.safeParse(unlockedScene).success).toBe(true);
    expect(() => assertValidPublicStory(unlockedScene)).toThrow(/claim differs from the locked Story Plan/);
  });
});
