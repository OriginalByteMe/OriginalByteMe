import { describe, it, expect } from "vitest";
import { validateSpec } from "@json-render/core";
import { homeSpec } from "@/lib/jsonui/homeSpec";
import { catalog } from "@/lib/jsonui/catalog";

describe("homeSpec", () => {
  it("passes json-render structural validation with no orphans", () => {
    const result = validateSpec(homeSpec, { checkOrphans: true });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("references only element keys that exist in the elements map", () => {
    const keys = new Set(Object.keys(homeSpec.elements));
    expect(keys.has(homeSpec.root)).toBe(true);
    for (const element of Object.values(homeSpec.elements)) {
      for (const childKey of element.children ?? []) {
        expect(keys.has(childKey)).toBe(true);
      }
    }
  });

  it("uses only component types defined in the catalog", () => {
    const componentNames = new Set(catalog.componentNames);
    for (const element of Object.values(homeSpec.elements)) {
      expect(componentNames.has(element.type)).toBe(true);
    }
  });

  it("cannot request a remote dotLottie package", () => {
    expect(catalog.componentNames).not.toContain("LottieFigure");
    expect(catalog.prompt()).not.toMatch(/dotlottie|\.lottie/i);
    expect(JSON.stringify(homeSpec)).not.toMatch(
      /https?:\/\/[^"]+\.lottie/i,
    );
  });
});
