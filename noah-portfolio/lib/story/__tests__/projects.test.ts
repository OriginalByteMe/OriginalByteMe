import { describe, expect, it } from "vitest";
import { corpus } from "@/lib/corpus";
import {
  CORPUS_PROJECT_PROMPT_CATALOG,
  UnknownProjectSlugError,
  resolveStoryProjects,
} from "@/lib/story/projects.server";
import { PROJECT_SLUGS } from "@/lib/story/types";

describe("trusted Story project resolution", () => {
  it("resolves locked slugs to exact Corpus cards in requested order", () => {
    const slugs = ["moodify", "ask-me-portfolio"] as const;
    const resolved = resolveStoryProjects(slugs);

    expect(resolved?.map((project) => project.slug)).toEqual(slugs);
    expect(resolved).toEqual(
      slugs.map((slug) => corpus.projects.find((project) => project.slug === slug)),
    );
    expect(resolveStoryProjects(undefined)).toBeUndefined();
  });

  it("keeps the client vocabulary and prompt catalog aligned with the active Corpus", () => {
    expect(corpus.projects.map((project) => project.slug).sort()).toEqual(
      [...PROJECT_SLUGS].sort(),
    );
    expect(CORPUS_PROJECT_PROMPT_CATALOG).toEqual(
      corpus.projects.map(({ slug, description }) => ({ slug, description })),
    );
  });

  it("uses a typed failure for unknown model-supplied slugs", () => {
    expect(() => resolveStoryProjects(["invented-project"])).toThrow(
      UnknownProjectSlugError,
    );
    try {
      resolveStoryProjects(["invented-project"]);
    } catch (error) {
      expect(error).toMatchObject({
        name: "UnknownProjectSlugError",
        code: "UNKNOWN_PROJECT_SLUG",
        message: "Unknown Corpus project slug: invented-project",
      });
    }
  });
});
