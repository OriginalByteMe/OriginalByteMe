import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getD1Env,
  getLangfuseEnv,
  getServerEnv,
  getStoryCacheHmacKey,
  getStoryCacheHmacKeyId,
} from "@/lib/env";

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.stubEnv("OPENROUTER_PROVIDER_ORDER", undefined);
  vi.stubEnv("OPENROUTER_FALLBACK_MODELS", undefined);
  vi.stubEnv("CF_ACCOUNT_ID", "");
  vi.stubEnv("STORY_CACHE_HMAC_KEY", "");
  vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "");
  vi.stubEnv("CF_D1_DATABASE_ID", "");
  vi.stubEnv("CF_D1_TOKEN", "");
  vi.stubEnv("PLAYWRIGHT_TEST_MODE", "");
  vi.stubEnv("LANGFUSE_PUBLIC_KEY", "");
  vi.stubEnv("LANGFUSE_SECRET_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("LLM environment", () => {
  it("defaults the model when unset", () => {
    expect(getServerEnv().openrouterModel).toBe("z-ai/glm-5.2");
  });

  it("leaves provider order unset by default", () => {
    expect(getServerEnv().openrouterProviderOrder).toBeUndefined();
  });

  it("parses a CSV provider order", () => {
    vi.stubEnv("OPENROUTER_PROVIDER_ORDER", "novita,deepinfra");
    expect(getServerEnv().openrouterProviderOrder).toEqual(["novita", "deepinfra"]);
  });

  it("trims provider-order whitespace", () => {
    vi.stubEnv("OPENROUTER_PROVIDER_ORDER", " novita , deepinfra ");
    expect(getServerEnv().openrouterProviderOrder).toEqual(["novita", "deepinfra"]);
  });

  it.each(["novita,,deepinfra", "novita,", "   "])(
    "rejects empty provider-order entries in %j",
    (providerOrder) => {
      vi.stubEnv("OPENROUTER_PROVIDER_ORDER", providerOrder);
      expect(() => getServerEnv()).toThrow(/must not contain empty entries/);
    },
  );

  it("defaults fallback models to the free-tier model", () => {
    expect(getServerEnv().openrouterFallbackModels).toEqual(["tencent/hy3:free"]);
  });

  it("treats an empty fallback-model list as unset", () => {
    vi.stubEnv("OPENROUTER_FALLBACK_MODELS", "");
    expect(getServerEnv().openrouterFallbackModels).toBeUndefined();
  });

  it("parses CSV fallback models", () => {
    vi.stubEnv("OPENROUTER_FALLBACK_MODELS", "tencent/hy3:free,openai/gpt-oss-20b:free");
    expect(getServerEnv().openrouterFallbackModels).toEqual([
      "tencent/hy3:free",
      "openai/gpt-oss-20b:free",
    ]);
  });

  it("trims fallback-model whitespace", () => {
    vi.stubEnv(
      "OPENROUTER_FALLBACK_MODELS",
      " tencent/hy3:free , openai/gpt-oss-20b:free ",
    );
    expect(getServerEnv().openrouterFallbackModels).toEqual([
      "tencent/hy3:free",
      "openai/gpt-oss-20b:free",
    ]);
  });

  it.each(["tencent/hy3:free,,openai/gpt-oss-20b:free", "tencent/hy3:free,", "   "])(
    "rejects empty fallback-model entries in %j",
    (fallbackModels) => {
      vi.stubEnv("OPENROUTER_FALLBACK_MODELS", fallbackModels);
      expect(() => getServerEnv()).toThrow(/must not contain empty entries/);
    },
  );

  it("throws when the API key is missing", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(() => getServerEnv()).toThrow(/OPENROUTER_API_KEY/);
  });
});

describe("Langfuse environment", () => {
  it("returns undefined when neither key is set", () => {
    expect(getLangfuseEnv()).toBeUndefined();
  });

  it.each([
    ["LANGFUSE_PUBLIC_KEY", "public-key"],
    ["LANGFUSE_SECRET_KEY", "secret-key"],
  ])("rejects partial configuration with only %s set", (name, value) => {
    vi.stubEnv(name, value);

    expect(() => getLangfuseEnv()).toThrow(
      /LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY together/,
    );
  });

  it("returns both keys when configured", () => {
    vi.stubEnv("LANGFUSE_PUBLIC_KEY", "public-key");
    vi.stubEnv("LANGFUSE_SECRET_KEY", "secret-key");

    expect(getLangfuseEnv()).toEqual({
      publicKey: "public-key",
      secretKey: "secret-key",
    });
  });
});

describe("Story environment", () => {

  it("accesses D1 configuration without requiring OpenRouter credentials", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    vi.stubEnv("CF_ACCOUNT_ID", "account");
    vi.stubEnv("CF_D1_DATABASE_ID", "database");
    vi.stubEnv("CF_D1_TOKEN", "d1-token");

    expect(getD1Env()).toEqual({ accountId: "account", databaseId: "database", token: "d1-token" });
  });

  it("rejects partial D1 configuration", () => {
    vi.stubEnv("CF_D1_DATABASE_ID", "database");
    expect(() => getD1Env()).toThrow(/requires CF_ACCOUNT_ID.*CF_D1_DATABASE_ID.*CF_D1_TOKEN/);
  });

  it("fails closed without a production HMAC key", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getStoryCacheHmacKey()).toThrow(/STORY_CACHE_HMAC_KEY/);
  });

  it.each(["staging", "preview"])(
    "fails closed without Story credentials in %s",
    (nodeEnv) => {
      vi.stubEnv("NODE_ENV", nodeEnv);
      expect(() => getStoryCacheHmacKey()).toThrow(/STORY_CACHE_HMAC_KEY/);
      expect(() => getStoryCacheHmacKeyId()).toThrow(/STORY_CACHE_HMAC_KEY_ID/);
    },
  );

  it("allows local Story credential fallbacks only in development, test, or Playwright", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getStoryCacheHmacKey()).toBe("local-only-story-cache-hmac-key");
    expect(getStoryCacheHmacKeyId()).toBe("local-v1");

    vi.stubEnv("NODE_ENV", "staging");
    vi.stubEnv("PLAYWRIGHT_TEST_MODE", "1");
    expect(getStoryCacheHmacKey()).toBe("local-only-story-cache-hmac-key");
    expect(getStoryCacheHmacKeyId()).toBe("local-v1");
  });

  it("rejects weak production HMAC keys and requires an explicit safe key ID", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STORY_CACHE_HMAC_KEY", "too-short");
    expect(() => getStoryCacheHmacKey()).toThrow(/at least 32 UTF-8 bytes/);

    vi.stubEnv("STORY_CACHE_HMAC_KEY", "a".repeat(32));
    expect(getStoryCacheHmacKey()).toBe("a".repeat(32));
    expect(() => getStoryCacheHmacKeyId()).toThrow(/STORY_CACHE_HMAC_KEY_ID/);

    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "rotation.v2");
    expect(getStoryCacheHmacKeyId()).toBe("rotation.v2");
    vi.stubEnv("STORY_CACHE_HMAC_KEY_ID", "unsafe key id");
    expect(() => getStoryCacheHmacKeyId()).toThrow(/safe 1-64 character identifier/);
  });

  it("accepts injected test secrets without environment credentials", () => {
    vi.stubEnv("NODE_ENV", "test");
    expect(getStoryCacheHmacKey("injected-secret")).toBe("injected-secret");
  });
});
