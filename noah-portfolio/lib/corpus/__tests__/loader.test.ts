import { describe, it, expect } from "vitest";
import { loadCorpus } from "@/lib/corpus/loader";

describe("loadCorpus", () => {
  const { corpus, knowledge } = loadCorpus();
  it("parses career frontmatter into typed jobs", () => {
    expect(corpus.careerTimeline.map((j) => j.company)).toContain("Supa");
  });
  it("parses all skill categories", () => {
    expect(corpus.skills.length).toBeGreaterThanOrEqual(4);
  });
  it("loads each project with a slug", () => {
    expect(corpus.projects.every((p) => p.slug && p.technologies.length > 0)).toBe(true);
  });
  it("collects prose bodies into knowledge", () => {
    expect(knowledge).toMatch(/Kuala Lumpur/);
  });
  it("loads bio.summary from the markdown body", () => {
    expect(corpus.bio.summary).toContain("passionate developer");
  });
});
