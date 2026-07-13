import { describe, it, expect } from "vitest";
import { loadCorpus } from "@/lib/corpus/loader";

describe("loadCorpus", () => {
  const { corpus, knowledge } = loadCorpus();
  it("parses career frontmatter into typed jobs", () => {
    const companies = corpus.careerTimeline.map((j) => j.company);
    expect(companies).toContain("MerchantSpring");
    expect(companies).toContain("Supa (formerly Supahands)");
    expect(companies).toContain("Bowiq");
  });
  it("parses all skill categories", () => {
    expect(corpus.skills.length).toBeGreaterThanOrEqual(5);
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
