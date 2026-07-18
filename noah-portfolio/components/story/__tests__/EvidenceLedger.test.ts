import { describe, expect, it } from "vitest";

import { getEvidenceLedgerRows } from "@/components/story/remotion/compositions/EvidenceLedger";

describe("getEvidenceLedgerRows", () => {
  it("renders human evidence labels instead of de-dashed IDs", () => {
    expect(
      getEvidenceLedgerRows(
        ["openrouter-model-routing", "missing-evidence"],
        [{ id: "openrouter-model-routing", label: "OpenRouter model routing" }],
      ),
    ).toEqual(["OpenRouter model routing", "missing evidence"]);
  });
});
