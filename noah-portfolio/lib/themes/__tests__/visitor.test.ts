import { describe, it, expect } from "vitest";

import { resolveVisitorCountry } from "@/lib/themes/visitor";

describe("resolveVisitorCountry — geo header (x-vercel-ip-country)", () => {
  it("prefers a valid geo header over Accept-Language", () => {
    const headers = new Headers({
      "x-vercel-ip-country": "DE",
      "accept-language": "en-US,en;q=0.9",
    });
    expect(resolveVisitorCountry(headers)).toBe("DE");
  });

  it("normalizes a lowercase geo code to uppercase alpha-2", () => {
    expect(
      resolveVisitorCountry(new Headers({ "x-vercel-ip-country": "de" })),
    ).toBe("DE");
  });

  it("falls through to Accept-Language when the geo header is malformed", () => {
    for (const bad of ["USA", "", "X1"]) {
      const headers = new Headers({
        "x-vercel-ip-country": bad,
        "accept-language": "fr-FR",
      });
      expect(resolveVisitorCountry(headers)).toBe("FR");
    }
  });

  it("treats the XX/xx unknown sentinel as a miss and falls through", () => {
    for (const sentinel of ["XX", "xx"]) {
      const headers = new Headers({
        "x-vercel-ip-country": sentinel,
        "accept-language": "en-GB",
      });
      expect(resolveVisitorCountry(headers)).toBe("GB");
    }
    // Sentinel with nothing to fall through to -> null.
    expect(
      resolveVisitorCountry(new Headers({ "x-vercel-ip-country": "XX" })),
    ).toBeNull();
  });
});

describe("resolveVisitorCountry — Accept-Language fallback", () => {
  it("takes the region subtag of the first listed tag", () => {
    expect(
      resolveVisitorCountry(
        new Headers({ "accept-language": "en-US,en;q=0.9" }),
      ),
    ).toBe("US");
  });

  it("scans past non-region subtags (zh-Hant-TW -> TW)", () => {
    expect(
      resolveVisitorCountry(new Headers({ "accept-language": "zh-Hant-TW" })),
    ).toBe("TW");
  });

  it("uppercases a lowercase region subtag", () => {
    expect(
      resolveVisitorCountry(new Headers({ "accept-language": "en-gb" })),
    ).toBe("GB");
  });

  it("returns null for a language tag with no region ('en')", () => {
    expect(
      resolveVisitorCountry(new Headers({ "accept-language": "en" })),
    ).toBeNull();
  });

  it("honours listed order, ignoring q-values", () => {
    // en-GB carries the higher q, but fr-FR is listed first and has a region.
    expect(
      resolveVisitorCountry(
        new Headers({ "accept-language": "fr-FR;q=0.5,en-GB;q=0.9" }),
      ),
    ).toBe("FR");
  });

  it("keeps scanning past a regionless leading tag", () => {
    expect(
      resolveVisitorCountry(new Headers({ "accept-language": "en,fr-FR" })),
    ).toBe("FR");
  });
});

describe("resolveVisitorCountry — degenerate input", () => {
  it("returns null when no relevant headers are present", () => {
    expect(resolveVisitorCountry(new Headers())).toBeNull();
  });

  it("never throws on garbage Accept-Language", () => {
    const headers = new Headers({ "accept-language": ";;;," });
    expect(() => resolveVisitorCountry(headers)).not.toThrow();
    expect(resolveVisitorCountry(headers)).toBeNull();
  });
});
