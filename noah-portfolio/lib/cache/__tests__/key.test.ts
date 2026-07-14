import { describe, expect, it } from "vitest";
import {
  normalizeQuestion,
  questionDigest,
  storyCacheIdentity,
} from "@/lib/cache/key";
import { CORPUS_REVISION, STORY_CONTRACT_VERSION } from "@/lib/story/types";

const SECRET = "identity-test-secret-one";

describe("normalizeQuestion", () => {
  it("normalizes equivalent Unicode, case, and whitespace", () => {
    expect(normalizeQuestion("  What  Does Noah DO? ")).toBe("what does noah do?");
    expect(normalizeQuestion("ＡＳＫ\tNOAH")).toBe("ask noah");
  });
});

describe("storyCacheIdentity", () => {
  it("maps equivalent normalized questions to the same private identity", () => {
    expect(storyCacheIdentity("What projects have you built?", { secret: SECRET })).toBe(
      storyCacheIdentity("  what   projects have you built?  ", { secret: SECRET }),
    );
  });

  it("changes across Corpus, contract, and key rotations", () => {
    const question = "What projects have you built?";
    const active = storyCacheIdentity(question, { secret: SECRET });

    expect(storyCacheIdentity(question, { secret: SECRET, corpusRevision: `${CORPUS_REVISION}-next` })).not.toBe(active);
    expect(storyCacheIdentity(question, { secret: SECRET, storyContractVersion: `${STORY_CONTRACT_VERSION}-next` })).not.toBe(active);
    expect(storyCacheIdentity(question, { secret: "identity-test-secret-two" })).not.toBe(active);
  });

  it("contains no raw or normalized question text and is not the unkeyed digest", () => {
    const question = "What Projects Has Noah Built?";
    const normalized = normalizeQuestion(question);
    const identity = storyCacheIdentity(question, { secret: SECRET });

    expect(identity).toMatch(/^[a-f0-9]{64}$/);
    expect(identity).not.toContain(question);
    expect(identity).not.toContain(normalized);
    expect(identity).not.toBe(questionDigest(question));
  });

  it("cannot be reproduced with a different or absent secret", () => {
    const question = "How does Noah approach systems?";
    const keyed = storyCacheIdentity(question, { secret: SECRET });
    const guessed = storyCacheIdentity(question, { secret: "attacker-guess" });

    expect(guessed).not.toBe(keyed);
  });
});
