import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  getD1Env,
  getStoryCacheHmacKey,
  getStoryCacheHmacKeyId,
  type CloudflareD1Config,
} from "@/lib/env";
import {
  normalizeQuestion,
  questionDigest,
  storyCacheIdentity,
} from "@/lib/story/identity";
import {
  CORPUS_REVISION,
  NewStoryRecordSchema,
  PublicStoryIdSchema,
  STORY_CONTRACT_VERSION,
  StoryPublicationTokenSchema,
  StoryQuestionSchema,
  StoryRecordSchema,
  type NewStoryRecord,
  type StoryPublicationToken,
  type StoryRecord,
} from "@/lib/story/types";
import { assertValidStoryRecord } from "@/lib/story/validation";
import { z } from "zod";

export interface StoryStoreOptions { signal?: AbortSignal }
export interface PreparedStory {
  story: StoryRecord;
  publicationToken: StoryPublicationToken;
}

export type StoryResolution =
  | { status: "current"; story: StoryRecord }
  | {
      status: "outdated";
      id: string;
      displayQuestion: string;
      corpusRevision: string;
      storyContractVersion: string;
    }
  | { status: "missing" };

interface StoryRow {
  public_id: string;
  cache_identity: string;
  hmac_key_id: string;
  record_json: string;
  published: number;
  expires_at: number;
}

const PENDING_STORY_TTL_SECONDS = 10 * 60;

const StoredMetadataSchema = z.object({
  id: PublicStoryIdSchema,
  displayQuestion: StoryQuestionSchema,
  corpusRevision: z.string().trim().min(1).max(120),
  storyContractVersion: z.string().trim().min(1).max(120),
});

const CREATE_STORY_TABLE_SQL = `CREATE TABLE IF NOT EXISTS story_records (
  public_id TEXT PRIMARY KEY NOT NULL,
  cache_identity TEXT NOT NULL UNIQUE,
  hmac_key_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  expires_at INTEGER NOT NULL
)`;

const PREPARE_STORY_SQL = `INSERT INTO story_records (
  public_id, cache_identity, hmac_key_id, record_json, published, expires_at
) VALUES (?, ?, ?, ?, 0, unixepoch() + ?)
ON CONFLICT(cache_identity) DO UPDATE SET
  public_id = CASE
    WHEN story_records.published = 0 AND story_records.expires_at <= unixepoch()
    THEN excluded.public_id ELSE story_records.public_id END,
  hmac_key_id = CASE
    WHEN story_records.published = 0 AND story_records.expires_at <= unixepoch()
    THEN excluded.hmac_key_id ELSE story_records.hmac_key_id END,
  record_json = CASE
    WHEN story_records.published = 0 AND story_records.expires_at <= unixepoch()
    THEN excluded.record_json ELSE story_records.record_json END,
  published = CASE
    WHEN story_records.published = 0 AND story_records.expires_at <= unixepoch()
    THEN 0 ELSE story_records.published END,
  expires_at = CASE
    WHEN story_records.published = 0 AND story_records.expires_at <= unixepoch()
    THEN excluded.expires_at ELSE story_records.expires_at END
RETURNING public_id, cache_identity, hmac_key_id, record_json, published, expires_at`;

const STORY_COLUMNS = "public_id, cache_identity, hmac_key_id, record_json, published, expires_at";

const globalMemory = globalThis as typeof globalThis & {
  __storyD1Memory?: {
    rowsByPublicId: Map<string, StoryRow>;
    publicIdByIdentity: Map<string, string>;
  };
};
const memory = globalMemory.__storyD1Memory ??= {
  rowsByPublicId: new Map<string, StoryRow>(),
  publicIdByIdentity: new Map<string, string>(),
};
const initializedDatabases = new Set<string>();
let loadedPlaywrightFixtureSource: string | undefined;

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function shouldUseMemoryStore(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.PLAYWRIGHT_TEST_MODE === "1";
}

function requireD1Config(): CloudflareD1Config {
  const config = getD1Env();
  if (!config) throw new Error("Cloudflare D1 Story storage is required in production");
  return config;
}

function d1ErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "unknown D1 error";
  const errors = "errors" in payload ? payload.errors : undefined;
  if (!Array.isArray(errors)) return "unknown D1 error";
  return errors
    .map((error) => {
      if (!error || typeof error !== "object" || !("message" in error)) return "D1 query error";
      return String(error.message);
    })
    .join("; ");
}

async function d1Query<T extends object>(
  config: CloudflareD1Config,
  sql: string,
  params: readonly unknown[] = [],
  signal?: AbortSignal,
): Promise<T[]> {
  signal?.throwIfAborted();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      signal,
    },
  );
  const payload = await response.json() as {
    success?: boolean;
    errors?: unknown[];
    result?: Array<{ success?: boolean; results?: T[]; error?: string }>;
    results?: T[];
  };
  const execution = Array.isArray(payload.result) ? payload.result[0] : undefined;
  if (!response.ok || payload.success === false || execution?.success === false) {
    const detail = execution?.error || d1ErrorMessage(payload);
    throw new Error(`D1 query failed (${response.status}): ${detail}`);
  }
  return execution?.results ?? payload.results ?? [];
}

async function ensureD1Schema(config: CloudflareD1Config, signal?: AbortSignal): Promise<void> {
  const databaseKey = `${config.accountId}/${config.databaseId}`;
  if (initializedDatabases.has(databaseKey)) return;
  await d1Query(config, CREATE_STORY_TABLE_SQL, [], signal);
  initializedDatabases.add(databaseKey);
}

function publicationTokenFor(publicId: string): StoryPublicationToken {
  const signature = createHmac("sha256", getStoryCacheHmacKey())
    .update(`story-publication:v1:${publicId}`, "utf8")
    .digest("base64url");
  return StoryPublicationTokenSchema.parse(`${publicId}.${signature}`);
}

function publicIdFromPublicationToken(token: string): string {
  const parsed = StoryPublicationTokenSchema.parse(token);
  const separator = parsed.indexOf(".");
  const publicId = parsed.slice(0, separator);
  const supplied = Buffer.from(parsed.slice(separator + 1), "ascii");
  const expected = Buffer.from(publicationTokenFor(publicId).slice(separator + 1), "ascii");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid Story publication token signature");
  }
  return publicId;
}

function rowForFixture(record: StoryRecord): StoryRow {
  return {
    public_id: record.id,
    cache_identity: storyCacheIdentity(record.displayQuestion, {
      corpusRevision: record.corpusRevision,
      storyContractVersion: record.storyContractVersion,
    }),
    hmac_key_id: getStoryCacheHmacKeyId(),
    record_json: JSON.stringify(record),
    published: 1,
    expires_at: 0,
  };
}

function seedMemoryRow(row: StoryRow): void {
  const existingId = memory.publicIdByIdentity.get(row.cache_identity);
  if (existingId && existingId !== row.public_id) {
    throw new Error("Invalid PLAYWRIGHT_STORY_FIXTURES: duplicate cache identity");
  }
  if (memory.rowsByPublicId.has(row.public_id)) {
    throw new Error("Invalid PLAYWRIGHT_STORY_FIXTURES: duplicate public ID");
  }
  memory.rowsByPublicId.set(row.public_id, row);
  memory.publicIdByIdentity.set(row.cache_identity, row.public_id);
}

function claimMemoryRow(candidate: StoryRow): StoryRow {
  const existingId = memory.publicIdByIdentity.get(candidate.cache_identity);
  if (existingId) {
    const existing = memory.rowsByPublicId.get(existingId)!;
    const now = Math.floor(Date.now() / 1000);
    if (existing.published === 1 || existing.expires_at > now) return existing;
    memory.rowsByPublicId.delete(existing.public_id);
  }
  if (memory.rowsByPublicId.has(candidate.public_id)) {
    throw new Error("Story public ID collision");
  }
  memory.rowsByPublicId.set(candidate.public_id, candidate);
  memory.publicIdByIdentity.set(candidate.cache_identity, candidate.public_id);
  return candidate;
}

async function loadPlaywrightFixtures(): Promise<void> {
  if (process.env.PLAYWRIGHT_TEST_MODE !== "1") return;
  const source = process.env.PLAYWRIGHT_STORY_FIXTURES;
  if (!source || source === loadedPlaywrightFixtureSource) return;

  const fixtures = z.array(StoryRecordSchema).safeParse(parseJson(source));
  if (!fixtures.success) {
    throw new Error("Invalid PLAYWRIGHT_STORY_FIXTURES: expected a JSON array of complete StoryRecord objects");
  }
  for (const record of fixtures.data) {
    assertValidStoryRecord(record);
    seedMemoryRow(rowForFixture(record));
  }
  loadedPlaywrightFixtureSource = source;
}

function validateCompleteInput(input: NewStoryRecord): NewStoryRecord {
  const parsed = NewStoryRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid complete Story input: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
  }
  const validationEnvelope: StoryRecord = {
    ...parsed.data,
    id: "AAAAAAAAAAAAAAAAAAAAAAAA",
    questionDigest: questionDigest(parsed.data.displayQuestion),
    corpusRevision: CORPUS_REVISION,
    storyContractVersion: STORY_CONTRACT_VERSION,
    createdAt: new Date(0).toISOString(),
  };
  assertValidStoryRecord(validationEnvelope);
  return parsed.data;
}

function parseValidatedRow(row: StoryRow): StoryRecord | null {
  const value = parseJson(row.record_json);
  try {
    assertValidStoryRecord(value);
  } catch {
    return null;
  }
  return row.public_id === value.id ? value : null;
}

function parseCompatibleRow(row: StoryRow, question: string): StoryRecord | null {
  const value = parseValidatedRow(row);
  if (!value ||
    row.cache_identity !== storyCacheIdentity(question) ||
    row.hmac_key_id !== getStoryCacheHmacKeyId() ||
    value.corpusRevision !== CORPUS_REVISION ||
    value.storyContractVersion !== STORY_CONTRACT_VERSION ||
    value.questionDigest !== questionDigest(question) ||
    normalizeQuestion(value.displayQuestion) !== normalizeQuestion(question)
  ) {
    return null;
  }
  return value;
}

function parseCurrentRow(row: StoryRow, question: string): StoryRecord | null {
  return row.published === 1 ? parseCompatibleRow(row, question) : null;
}

async function selectPublishedByIdentity(identity: string): Promise<StoryRow | null> {
  if (shouldUseMemoryStore()) {
    const publicId = memory.publicIdByIdentity.get(identity);
    const row = publicId ? memory.rowsByPublicId.get(publicId) : undefined;
    return row?.published === 1 ? row : null;
  }
  const config = requireD1Config();
  await ensureD1Schema(config);
  const rows = await d1Query<StoryRow>(
    config,
    `SELECT ${STORY_COLUMNS} FROM story_records WHERE cache_identity = ? AND published = 1 LIMIT 1`,
    [identity],
  );
  return rows[0] ?? null;
}

async function selectPendingByIdentity(identity: string): Promise<StoryRow | null> {
  if (shouldUseMemoryStore()) {
    const publicId = memory.publicIdByIdentity.get(identity);
    const row = publicId ? memory.rowsByPublicId.get(publicId) : undefined;
    return row?.published === 0 && row.expires_at > Math.floor(Date.now() / 1000)
      ? row
      : null;
  }
  const config = requireD1Config();
  await ensureD1Schema(config);
  const rows = await d1Query<StoryRow>(
    config,
    `SELECT ${STORY_COLUMNS} FROM story_records
     WHERE cache_identity = ? AND published = 0 AND expires_at > unixepoch()
     LIMIT 1`,
    [identity],
  );
  return rows[0] ?? null;
}

async function selectPublishedByPublicId(publicId: string): Promise<StoryRow | null> {
  if (shouldUseMemoryStore()) {
    const row = memory.rowsByPublicId.get(publicId);
    return row?.published === 1 ? row : null;
  }
  const config = requireD1Config();
  await ensureD1Schema(config);
  const rows = await d1Query<StoryRow>(
    config,
    `SELECT ${STORY_COLUMNS} FROM story_records WHERE public_id = ? AND published = 1 LIMIT 1`,
    [publicId],
  );
  return rows[0] ?? null;
}

async function selectAnyByPublicId(publicId: string, signal?: AbortSignal): Promise<StoryRow | null> {
  if (shouldUseMemoryStore()) return memory.rowsByPublicId.get(publicId) ?? null;
  const config = requireD1Config();
  await ensureD1Schema(config, signal);
  const rows = await d1Query<StoryRow>(
    config,
    `SELECT ${STORY_COLUMNS} FROM story_records WHERE public_id = ? LIMIT 1`,
    [publicId],
    signal,
  );
  return rows[0] ?? null;
}

/** Return only a published, complete current Story for an equivalent question. */
export async function findCurrentStory(question: string): Promise<StoryRecord | null> {
  const parsedQuestion = StoryQuestionSchema.parse(question);
  await loadPlaywrightFixtures();
  const row = await selectPublishedByIdentity(storyCacheIdentity(parsedQuestion));
  return row ? parseCurrentRow(row, parsedQuestion) : null;
}

/** Return an unexpired compatible pending Story so retries replay its canonical winner. */
export async function findPreparedStory(question: string): Promise<PreparedStory | null> {
  const parsedQuestion = StoryQuestionSchema.parse(question);
  const row = await selectPendingByIdentity(storyCacheIdentity(parsedQuestion));
  if (!row) return null;
  const story = parseCompatibleRow(row, parsedQuestion);
  return story
    ? { story, publicationToken: publicationTokenFor(story.id) }
    : null;
}

function makeCandidate(complete: NewStoryRecord): StoryRecord {
  const record: StoryRecord = {
    ...complete,
    id: randomBytes(18).toString("base64url"),
    questionDigest: questionDigest(complete.displayQuestion),
    corpusRevision: CORPUS_REVISION,
    storyContractVersion: STORY_CONTRACT_VERSION,
    createdAt: new Date().toISOString(),
  };
  assertValidStoryRecord(record);
  return record;
}

/** Fully validate and atomically claim an unpublished Story identity. */
export async function prepareCompleteStory(
  input: NewStoryRecord,
  options: StoryStoreOptions = {},
): Promise<PreparedStory> {
  const complete = validateCompleteInput(input);
  options.signal?.throwIfAborted();
  const identity = storyCacheIdentity(complete.displayQuestion);
  const hmacKeyId = getStoryCacheHmacKeyId();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    options.signal?.throwIfAborted();
    const candidate = makeCandidate(complete);
    const candidateRow: StoryRow = {
      public_id: candidate.id,
      cache_identity: identity,
      hmac_key_id: hmacKeyId,
      record_json: JSON.stringify(candidate),
      published: 0,
      expires_at: Math.floor(Date.now() / 1000) + PENDING_STORY_TTL_SECONDS,
    };

    let claimed: StoryRow;
    if (shouldUseMemoryStore()) {
      claimed = claimMemoryRow(candidateRow);
    } else {
      const config = requireD1Config();
      await ensureD1Schema(config, options.signal);
      try {
        const rows = await d1Query<StoryRow>(
          config,
          PREPARE_STORY_SQL,
          [candidate.id, identity, hmacKeyId, candidateRow.record_json, PENDING_STORY_TTL_SECONDS],
          options.signal,
        );
        if (!rows[0]) throw new Error("D1 Story prepare returned no record");
        claimed = rows[0];
      } catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed: story_records\.public_id/i.test(error.message)) {
          continue;
        }
        throw error;
      }
    }

    const story = parseValidatedRow(claimed);
    if (!story || claimed.cache_identity !== identity || claimed.hmac_key_id !== hmacKeyId) {
      throw new Error("Prepared Story failed complete-record revalidation");
    }
    return { story, publicationToken: publicationTokenFor(story.id) };
  }
  throw new Error("Could not allocate an unused opaque Story ID");
}

/** Publish a prepared Story atomically; repeated calls are idempotent. */
export async function publishPreparedStory(
  publicationToken: string,
  options: StoryStoreOptions = {},
): Promise<StoryRecord> {
  options.signal?.throwIfAborted();
  const publicId = publicIdFromPublicationToken(publicationToken);
  const hmacKeyId = getStoryCacheHmacKeyId();

  let published: StoryRow | undefined;
  if (shouldUseMemoryStore()) {
    const row = memory.rowsByPublicId.get(publicId);
    if (!row || row.hmac_key_id !== hmacKeyId) throw new Error("Story publication token is not recognized");
    if (row.published === 0) {
      if (row.expires_at <= Math.floor(Date.now() / 1000)) {
        throw new Error("Story publication token has expired");
      }
      options.signal?.throwIfAborted();
      row.published = 1;
      row.expires_at = 0;
    }
    published = row;
  } else {
    const config = requireD1Config();
    await ensureD1Schema(config, options.signal);
    const rows = await d1Query<StoryRow>(
      config,
      `UPDATE story_records SET published = 1, expires_at = 0
       WHERE public_id = ? AND hmac_key_id = ?
         AND published = 0 AND expires_at > unixepoch()
       RETURNING ${STORY_COLUMNS}`,
      [publicId, hmacKeyId],
      options.signal,
    );
    published = rows[0];
    if (!published) {
      const existing = await selectAnyByPublicId(publicId, options.signal);
      if (!existing || existing.hmac_key_id !== hmacKeyId) {
        throw new Error("Story publication token is not recognized");
      }
      if (existing.published !== 1) throw new Error("Story publication token has expired");
      published = existing;
    }
  }

  const story = parseValidatedRow(published);
  if (!story) throw new Error("Published Story failed complete-record revalidation");
  return story;
}

/** Resolve an opaque ID; pending rows are missing and outdated rows never expose Scenes. */
export async function resolveStory(id: string): Promise<StoryResolution> {
  if (!PublicStoryIdSchema.safeParse(id).success) return { status: "missing" };
  await loadPlaywrightFixtures();
  const row = await selectPublishedByPublicId(id);
  if (!row || row.public_id !== id) return { status: "missing" };

  const value = parseJson(row.record_json);
  const metadata = StoredMetadataSchema.safeParse(value);
  if (!metadata.success || metadata.data.id !== id) return { status: "missing" };
  if (
    row.hmac_key_id !== getStoryCacheHmacKeyId() ||
    metadata.data.corpusRevision !== CORPUS_REVISION ||
    metadata.data.storyContractVersion !== STORY_CONTRACT_VERSION
  ) {
    return {
      status: "outdated",
      id: metadata.data.id,
      displayQuestion: metadata.data.displayQuestion,
      corpusRevision: metadata.data.corpusRevision,
      storyContractVersion: metadata.data.storyContractVersion,
    };
  }

  try {
    assertValidStoryRecord(value);
  } catch {
    return { status: "missing" };
  }
  return { status: "current", story: value };
}

/** Reset only process-local Story state used by focused tests. */
export function __resetStoryStoreForTests(): void {
  memory.rowsByPublicId.clear();
  memory.publicIdByIdentity.clear();
  initializedDatabases.clear();
  loadedPlaywrightFixtureSource = undefined;
}
