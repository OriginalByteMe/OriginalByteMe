// lib/__tests__/env.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { getServerEnv } from "@/lib/env";

describe("getServerEnv", () => {
  beforeEach(() => { process.env.OPENROUTER_API_KEY = "test-key"; delete process.env.OPENROUTER_MODEL; });
  it("defaults the model when unset", () => {
    expect(getServerEnv().openrouterModel).toBe("deepseek/deepseek-v4-flash");
  });
  it("throws when the API key is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(() => getServerEnv()).toThrow(/OPENROUTER_API_KEY/);
  });
  it("returns cf config only when all three CF vars are present", () => {
    expect(getServerEnv().cf).toBeUndefined();
  });
});
