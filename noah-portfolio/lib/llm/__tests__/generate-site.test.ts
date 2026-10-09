import { describe, expect, it } from "vitest";

import { SITE_RESPONSE_JSON_SCHEMA } from "@/lib/llm/generate-site";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";

describe("SITE_RESPONSE_JSON_SCHEMA", () => {
  it("lets the model cite only Evidence ids from the active Corpus, on the hero and on every section", () => {
    const citation = { items: { type: "string", enum: CORPUS_EVIDENCE_REFS.map((ref) => ref.id) } };

    expect(SITE_RESPONSE_JSON_SCHEMA).toMatchObject({
      properties: {
        hero: { properties: { evidenceRefIds: citation } },
        sections: { items: { properties: { evidenceRefIds: citation } } },
      },
    });
  });
});
