import { describe, it, expect } from "vitest";
import { catalog } from "@/lib/jsonui/catalog";
import { z } from "zod";

/** Minimal shape of the runtime catalog.data structure that defineCatalog produces. */
type CatalogRuntime = {
  data: {
    components: Record<string, { props: z.ZodTypeAny }>;
  };
};

describe("catalog", () => {
  it("exposes the fact-block components", () => {
    const prompt = catalog.prompt();
    for (const name of ["CareerTimeline", "ProjectShowcase", "SkillGrid", "ContactCard", "StepFlow"])
      expect(prompt).toContain(name);
  });
  it("ProjectShowcase rejects a missing statePath prop", () => {
    // catalog.data.components is a library-internal path not reflected in the inferred type;
    // cast via unknown rather than any so the boundary is explicit.
    const def = (catalog as unknown as CatalogRuntime).data.components.ProjectShowcase.props;
    expect(def.safeParse({}).success).toBe(false);
  });

  describe("SequencedTimeline source", () => {
    const def = (catalog as unknown as CatalogRuntime).data.components.SequencedTimeline.props;
    const rows = [{ period: "2024-present", role: "Engineer", company: "Bowiq" }];

    it("accepts inline rows only", () => {
      expect(def.safeParse({ rows }).success).toBe(true);
    });

    it("preserves a valid official URL on an inline row", () => {
      const result = def.safeParse({
        rows: [{ ...rows[0], url: "https://bowiq.com" }],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rows?.[0]).toMatchObject({ url: "https://bowiq.com" });
      }
    });

    it("rejects a malformed company URL", () => {
      expect(
        def.safeParse({ rows: [{ ...rows[0], url: "bowiq.com" }] }).success,
      ).toBe(false);
    });

    it("accepts a Corpus statePath only", () => {
      expect(def.safeParse({ statePath: "/corpus/careerTimeline" }).success).toBe(true);
    });

    it("rejects a missing source", () => {
      expect(def.safeParse({}).success).toBe(false);
    });

    it("rejects both inline rows and a statePath", () => {
      expect(def.safeParse({ rows, statePath: "/corpus/careerTimeline" }).success).toBe(false);
    });
  });
});
