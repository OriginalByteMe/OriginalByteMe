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
});
