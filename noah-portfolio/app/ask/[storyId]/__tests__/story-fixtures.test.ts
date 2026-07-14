import { describe, expect, it } from "vitest";
import { assertValidStoryRecord } from "@/lib/story/validation";
import { STORY_CONTRACT_VERSION } from "@/lib/story/types";
import {
  CURRENT_PUBLIC_STORY,
  CURRENT_STORY_RECORD,
  OUTDATED_STORY_RECORD,
  PLAYWRIGHT_STORY_RECORDS,
  RELATED_PUBLIC_STORY,
} from "./story-fixtures";

describe("public Story browser fixtures", () => {
  it("keeps every seeded record complete and grounded", () => {
    for (const record of PLAYWRIGHT_STORY_RECORDS) {
      expect(() => assertValidStoryRecord(record)).not.toThrow();
      if (record.storyContractVersion === STORY_CONTRACT_VERSION) {
        expect(record.scenes[1].projects?.map((project) => project.slug)).toEqual(
          record.plan.scenes[1].projectSlugs,
        );
      }
    }
  });

  it("uses the public projection for generated client events", () => {
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("questionDigest");
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("corpusRevision");
    expect(CURRENT_PUBLIC_STORY).not.toHaveProperty("storyContractVersion");
    expect(RELATED_PUBLIC_STORY).not.toHaveProperty("questionDigest");
    expect(CURRENT_PUBLIC_STORY.id).toBe(CURRENT_STORY_RECORD.id);
    expect(CURRENT_STORY_RECORD.storyContractVersion).toBe(STORY_CONTRACT_VERSION);
    expect(CURRENT_PUBLIC_STORY.scenes.map((scene) => scene.assetId)).toEqual([
      "circuit-mind",
      "print-layers",
      "morning-coffee",
    ]);
    expect(CURRENT_PUBLIC_STORY.scenes[1].projects?.[0].title).toBe("Ask-Me Portfolio");
    expect(OUTDATED_STORY_RECORD.scenes.some((scene) => scene.body.includes("STALE"))).toBe(true);
  });
});
