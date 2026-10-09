import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CORPUS_EVIDENCE_REFS, resolveStoryProjects } from "@/lib/story/evidence";
import { assertValidPublicStory } from "@/lib/story/public-validation";
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
  StoryStreamEventSchema,
  StoryQuestionSchema,
  normalizeQuestion,
  toPublicStory,
  type NewStoryRecord,
  type Site,
  type StoryRecord,
} from "@/lib/story/types";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_STORY_RECORD,
  OUTDATED_STORY_RECORD,
  PLAYWRIGHT_STORY_RECORDS,
  RELATED_PUBLIC_STORY,
} from "@/lib/story/__fixtures__/story-fixtures";
import { assertValidSite, assertValidStoryRecord } from "@/lib/story/validation";

const DEFAULT_QUESTION = "What does Noah self-host?";
const CITED_IDS = ["fun-fact-2", "operating-systems-4", "project-llm-comparison", "project-moodify"];
const evidence = CORPUS_EVIDENCE_REFS.filter((ref) => CITED_IDS.includes(ref.id));

function makeSite(): Site {
  return {
    mode: "grounded",
    layout: "bento",
    palette: "forest",
    brand: "Noah / Homelab",
    hero: {
      evidenceRefIds: ["fun-fact-2"],
      eyebrow: "Self-hosting",
      headline: "I self-host on Proxmox and Unraid",
      lede: "My homelab runs on Proxmox and Unraid.",
      art: "server-rack",
    },
    sections: [
      {
        kind: "list",
        evidenceRefIds: ["operating-systems-4"],
        title: "Linux and Unraid on the server",
        nav: "Server",
        body: "My homelab server runs Linux and Unraid.",
        items: [{ title: "Linux", text: "Runs on my homelab server.", art: "server-rack" }],
      },
      {
        kind: "cards",
        evidenceRefIds: ["project-llm-comparison", "project-moodify"],
        title: "LLM Comparison and Moodify",
        nav: "Projects",
        body: "My portfolio includes these two projects.",
        items: [],
        projectSlugs: ["llm-comparison", "moodify"],
        projects: resolveStoryProjects(["llm-comparison", "moodify"]),
      },
    ],
    relatedQuestions: ["Which databases does Noah know?", "Where is Noah based?"],
  };
}

function makeBoundarySite(): Site {
  return {
    mode: "boundary",
    layout: "editorial",
    palette: "paper",
    brand: "Noah",
    hero: {
      evidenceRefIds: [],
      eyebrow: "Not shared",
      headline: "I haven't shared my salary",
      lede: "That is not something I have published.",
      art: "coffee-cup",
    },
    sections: [],
    relatedQuestions: ["Where has Noah worked?", "What does Noah self-host?"],
  };
}

function makeInput(displayQuestion = DEFAULT_QUESTION): NewStoryRecord {
  return { displayQuestion, site: makeSite(), evidence: evidence.map((ref) => ({ ...ref })) };
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

describe("Site validation", () => {
  it.each([
    { label: "grounded", site: makeSite() },
    { label: "boundary", site: makeBoundarySite() },
  ])("accepts a valid $label site", ({ site }) => {
    expect(() => assertValidSite(site, CORPUS_EVIDENCE_REFS)).not.toThrow();
  });

  it.each<{ label: string; mutate: (site: Site) => unknown; error: RegExp }>([
    {
      label: "a grounded site with no sections",
      mutate: (site) => { site.sections = []; },
      error: /grounded mode requires at least one section/,
    },
    {
      label: "a hero without Evidence Refs",
      mutate: (site) => { site.hero.evidenceRefIds = []; },
      error: /at least one Evidence Ref on the hero/,
    },
    {
      label: "a section without Evidence Refs",
      mutate: (site) => { site.sections[1].evidenceRefIds = []; },
      error: /sections\.1\.evidenceRefIds/,
    },
    {
      label: "an unknown Evidence Ref",
      mutate: (site) => { site.sections[0].evidenceRefIds = ["invented-ref"]; },
      error: /unknown Evidence Ref ID invented-ref/,
    },
    {
      label: "a duplicate Evidence Ref in one list",
      mutate: (site) => { site.hero.evidenceRefIds = ["fun-fact-2", "fun-fact-2"]; },
      error: /Evidence Ref IDs must be unique/,
    },
    {
      label: "a boundary site citing Evidence",
      mutate: (site) => {
        Object.assign(site, makeBoundarySite());
        site.hero.evidenceRefIds = ["fun-fact-2"];
      },
      error: /boundary mode must not cite Evidence Refs/,
    },
    {
      label: "a boundary site with sections",
      mutate: (site) => { site.mode = "boundary"; site.hero.evidenceRefIds = []; },
      error: /boundary mode must not include sections/,
    },
    {
      label: "an unknown art id",
      mutate: (site) => { site.sections[0].items[0].art = "remote-svg" as never; },
      error: /Unknown art id/,
    },
    {
      label: "an unknown project slug",
      mutate: (site) => { site.sections[1].projectSlugs = ["invented-project" as never]; },
      error: /Unknown Corpus project slug/,
    },
    {
      label: "a model-authored project card",
      mutate: (site) => {
        const [first, ...rest] = site.sections[1].projects!;
        site.sections[1].projects = [{ ...first, title: "Model-authored title" }, ...rest];
      },
      error: /projects must exactly match the Corpus cards/,
    },
    {
      label: "projects without projectSlugs",
      mutate: (site) => { delete site.sections[1].projectSlugs; },
      error: /projects require projectSlugs/,
    },
    {
      label: "duplicate related questions",
      mutate: (site) => { site.relatedQuestions = ["Where is Noah based?", "  where is NOAH based? "]; },
      error: /Related Questions must be unique/,
    },
  ])("rejects $label", ({ mutate, error }) => {
    const site = makeSite();
    mutate(site);
    expect(() => assertValidSite(site, CORPUS_EVIDENCE_REFS)).toThrow(error);
  });

  it("rejects Evidence Refs that differ from the active Corpus", () => {
    const changed = evidence.map((ref) => ({ ...ref }));
    changed[0].excerpt = "A model-authored replacement";
    expect(() => assertValidSite(makeSite(), changed)).toThrow(/active Corpus vocabulary/);
  });

  it("uses one trimmed 280-character Question contract for display and related questions", async () => {
    const boundary = "q".repeat(MAX_STORY_QUESTION_LENGTH);
    expect(StoryQuestionSchema.parse(`  ${boundary}  `)).toBe(boundary);
    expect(StoryQuestionSchema.safeParse("   ").success).toBe(false);

    const longRelated = makeSite();
    longRelated.relatedQuestions[0] = `${boundary}q`;
    expect(() => assertValidSite(longRelated, CORPUS_EVIDENCE_REFS)).toThrow(/at most 280 characters/);
    await expect(storePublishedStory(makeInput(`${boundary}q`))).rejects.toThrow(/at most 280 characters/);
  });
});

describe("public Story browser fixtures", () => {
  it("keeps seeded records valid and public projections free of compatibility metadata", () => {
    for (const record of PLAYWRIGHT_STORY_RECORDS) {
      expect(() => assertValidStoryRecord(record)).not.toThrow();
    }
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("corpusRevision");
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("storyContractVersion");
    expect(RELATED_PUBLIC_STORY).not.toHaveProperty("corpusRevision");
    expect(CURRENT_PUBLIC_STORY.id).toBe(CURRENT_STORY_RECORD.id);
    expect(OUTDATED_STORY_RECORD.site.hero.headline).toContain("STALE");
  });
});

describe("Story persistence and resolution", () => {
  it("rejects incomplete input, hides prepared rows, and publishes a v7 record idempotently", async () => {
    const uncited = makeInput();
    uncited.evidence = uncited.evidence.filter((ref) => ref.id !== "fun-fact-2");
    await expect(prepareCompleteStory(uncited)).rejects.toThrow(/unknown Evidence Ref ID fun-fact-2/);

    const boundaryWithEvidence: NewStoryRecord = { ...makeInput(), site: makeBoundarySite() };
    await expect(prepareCompleteStory(boundaryWithEvidence)).rejects.toThrow(
      /boundary mode must not include Evidence/,
    );

    const prepared = await prepareCompleteStory(makeInput());
    expect(prepared.story.storyContractVersion).toBe(STORY_CONTRACT_VERSION);
    await expect(findCurrentStory(prepared.story.displayQuestion)).resolves.toBeNull();
    await expect(resolveStory(prepared.story.id)).resolves.toEqual({ status: "missing" });

    const published = await publishPreparedStory(prepared.publicationToken);
    expect(published.site).toEqual(makeSite());
    await expect(resolveStory(published.id)).resolves.toEqual({ status: "current", story: published });
    await expect(publishPreparedStory(prepared.publicationToken)).resolves.toEqual(published);
  });

  it("atomically reuses one pending ID for concurrent equivalent prepares", async () => {
    const [first, concurrent] = await Promise.all([
      prepareCompleteStory(makeInput("  WHAT   does Noah self-host?  ")),
      prepareCompleteStory(makeInput("what does noah self-host?")),
    ]);

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
    expect(second.id).not.toBe(first.id);
    expect(first.id).not.toBe(storyCacheIdentity(first.displayQuestion, { secret: "focused-test-story-secret" }));
  });

  it("normalizes equivalent questions and versions private cache identities", () => {
    const secret = "identity-test-secret-one";
    const question = "What Projects Has Noah Built?";
    const identity = storyCacheIdentity(question, { secret });

    expect(normalizeQuestion("  What  Does Noah DO? ")).toBe("what does noah do?");
    expect(normalizeQuestion("ＡＳＫ\tNOAH")).toBe("ask noah");
    expect(identity).toBe(storyCacheIdentity("  what   projects has noah built?  ", { secret }));
    expect(identity).toMatch(/^[a-f0-9]{64}$/);
    expect(storyCacheIdentity(question, { secret: "identity-test-secret-two" })).not.toBe(identity);
    expect(storyCacheIdentity(question, { secret, corpusRevision: `${CORPUS_REVISION}-next` })).not.toBe(identity);
    expect(
      storyCacheIdentity(question, { secret, storyContractVersion: `${STORY_CONTRACT_VERSION}-next` }),
    ).not.toBe(identity);
  });

  it.each([
    { label: "exact current", corpusRevision: CORPUS_REVISION, storyContractVersion: STORY_CONTRACT_VERSION, rotateKeyId: false, expectedStatus: "current" },
    { label: "Corpus-only mismatch", corpusRevision: "retired-corpus", storyContractVersion: STORY_CONTRACT_VERSION, rotateKeyId: false, expectedStatus: "outdated" },
    { label: "Story-Contract-only mismatch", corpusRevision: CORPUS_REVISION, storyContractVersion: "v2", rotateKeyId: false, expectedStatus: "outdated" },
    { label: "key-ID-only rotation", corpusRevision: CORPUS_REVISION, storyContractVersion: STORY_CONTRACT_VERSION, rotateKeyId: true, expectedStatus: "outdated" },
  ] as const)("resolves $label without exposing a stale Site", async (variant) => {
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
    }
  });

  it("rejects malformed fixture records and duplicate fixture cache identities", async () => {
    expect(() => seedStoryFixtures([{ id: "A9wE3rT7_yU1iO5pS8dF2gH4", displayQuestion: DEFAULT_QUESTION }])).toThrow(
      /Invalid Story fixtures/,
    );

    const base = await storePublishedStory(makeInput());
    __resetStoryStoreForTests();
    expect(() => seedStoryFixtures([base, { ...base, id: "A9wE3rT7_yU1iO5pS8dF2gH4" }])).toThrow(
      /duplicate cache identity/,
    );
  });

  it("lets a key-ID rotation replace a published identity with a new current Story", async () => {
    const old = await storePublishedStory(makeInput());
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "focused-v2");

    expect(await resolveStory(old.id)).toMatchObject({ status: "outdated", id: old.id });
    await expect(findCurrentStory(old.displayQuestion)).resolves.toBeNull();
    const regenerated = await storePublishedStory(makeInput());
    expect(regenerated.id).not.toBe(old.id);
    await expect(findCurrentStory(old.displayQuestion)).resolves.toEqual(regenerated);
  });

  it("fails closed when production Story storage has no D1 configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORY_CACHE_HMAC_KEY", "p".repeat(32));
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "production-v1");
    await expect(findCurrentStory("How does Noah work?")).rejects.toThrow(/D1 Story storage is required/);
  });

  function stubD1(rows: { stored?: Record<string, string | number> }) {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CF_ACCOUNT_ID", "account-id");
    vi.stubEnv("CF_D1_DATABASE_ID", "database-id");
    vi.stubEnv("CF_D1_TOKEN", "d1-token");
    vi.stubEnv("STORY_CACHE_HMAC_KEY", "d".repeat(32));
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "d1-test-v1");
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { sql: string; params: Array<string | number> };
      let results: Array<Record<string, string | number>> = [];
      if (request.sql.startsWith("INSERT INTO story_records")) {
        rows.stored = {
          public_id: request.params[0],
          cache_identity: request.params[1],
          hmac_key_id: request.params[2],
          record_json: request.params[3],
          published: 0,
          expires_at: Math.floor(Date.now() / 1000) + Number(request.params[4]),
        };
        results = [rows.stored];
      } else if (request.sql.startsWith("UPDATE story_records") && rows.stored) {
        rows.stored.published = 1;
        rows.stored.expires_at = 0;
        results = [rows.stored];
      } else if (request.sql.startsWith("SELECT")) {
        results = rows.stored ? [rows.stored] : [];
      }
      return new Response(JSON.stringify({ success: true, result: [{ success: true, results }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("round-trips a v7 record through the D1 REST query endpoint", async () => {
    const fetchMock = stubD1({});

    const stored = await storePublishedStory(makeInput());
    await expect(resolveStory(stored.id)).resolves.toEqual({ status: "current", story: stored });

    const upsert = JSON.parse(String(fetchMock.mock.calls[1][1]?.body)) as { sql: string; params: string[] };
    expect(String(fetchMock.mock.calls[1][0])).toContain("/accounts/account-id/d1/database/database-id/query");
    expect(upsert.sql).toContain("ON CONFLICT(cache_identity)");
    expect(upsert.params[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(upsert.params[3]).site).toEqual(makeSite());
  });

  it("resolves a stored v6 Plan/Scene row as outdated and never serves it from cache", async () => {
    const id = "V6oldRowAbCdEfGhIjKlMnOp";
    const v6Record = {
      id,
      displayQuestion: DEFAULT_QUESTION,
      corpusRevision: CORPUS_REVISION,
      storyContractVersion: "v6",
      createdAt: "2026-07-14T07:00:00.000Z",
      plan: { question: DEFAULT_QUESTION, mode: "grounded", scenes: [] },
      scenes: [],
      evidence: [],
    };
    stubD1({
      stored: {
        public_id: id,
        cache_identity: storyCacheIdentity(DEFAULT_QUESTION, { storyContractVersion: "v6" }),
        hmac_key_id: "d1-test-v1",
        record_json: JSON.stringify(v6Record),
        published: 1,
        expires_at: 0,
      },
    });

    await expect(resolveStory(id)).resolves.toEqual({
      status: "outdated",
      id,
      displayQuestion: DEFAULT_QUESTION,
      corpusRevision: CORPUS_REVISION,
      storyContractVersion: "v6",
    });
    await expect(findCurrentStory(DEFAULT_QUESTION)).resolves.toBeNull();
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
    await expect(publishPreparedStory(`${prepared.story.id}.${"A".repeat(43)}`)).rejects.toThrow(/token signature/);

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

    expect(publicStory).not.toHaveProperty("corpusRevision");
    expect(publicStory).not.toHaveProperty("storyContractVersion");
    expect(StoryStreamEventSchema.parse({ type: "complete", story: publicStory })).toEqual({
      type: "complete",
      story: publicStory,
    });
    expect(StoryStreamEventSchema.safeParse({ type: "complete", story: record }).success).toBe(false);
  });

  it("rejects schema-valid Public Stories that break shared Site invariants", async () => {
    const publicStory = toPublicStory(await storePublishedStory(makeInput()));

    const duplicateEvidence = structuredClone(publicStory);
    duplicateEvidence.evidence.push({ ...duplicateEvidence.evidence[0] });
    expect(() => assertValidPublicStory(duplicateEvidence)).toThrow(/duplicate ID/);

    const uncitedSection = structuredClone(publicStory);
    uncitedSection.site.sections[0].evidenceRefIds = ["career-1"];
    expect(() => assertValidPublicStory(uncitedSection)).toThrow(/unknown Evidence Ref ID career-1/);
  });
});
