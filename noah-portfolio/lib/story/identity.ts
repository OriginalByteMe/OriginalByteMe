import { createHash, createHmac } from "node:crypto";
import { getStoryCacheHmacKey } from "@/lib/env";
import { normalizeQuestion } from "@/lib/story/normalize";
import { CORPUS_REVISION, STORY_CONTRACT_VERSION } from "@/lib/story/types";

export interface StoryCacheIdentityOptions {
  corpusRevision?: string;
  storyContractVersion?: string;
  secret?: string;
}
export { normalizeQuestion };


/** Server-side, unkeyed record metadata. Never use this digest as a key or public ID. */
export function questionDigest(question: string): string {
  const normalized = normalizeQuestion(question);
  if (!normalized) throw new Error("Cannot digest an empty question");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Private deterministic lookup identity. JSON array encoding is unambiguous and
 * the secret is never included in the returned value or any public payload.
 */
export function storyCacheIdentity(
  question: string,
  options: StoryCacheIdentityOptions = {},
): string {
  const normalized = normalizeQuestion(question);
  if (!normalized) throw new Error("Cannot identify an empty question");

  const payload = JSON.stringify([
    normalized,
    options.corpusRevision ?? CORPUS_REVISION,
    options.storyContractVersion ?? STORY_CONTRACT_VERSION,
  ]);
  return createHmac("sha256", getStoryCacheHmacKey(options.secret))
    .update(payload, "utf8")
    .digest("hex");
}
