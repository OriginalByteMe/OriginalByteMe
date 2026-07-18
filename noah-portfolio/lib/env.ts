export interface CloudflareD1Config {
  accountId: string;
  databaseId: string;
  token: string;
}

export interface OpenRouterEnv {
  openrouterApiKey: string;
  openrouterModel: string;
  openrouterProviderOrder: string[] | undefined;
}

export interface LangfuseEnv {
  publicKey: string;
  secretKey: string;
}

/** LLM-only environment access. Story identity and storage must not call this. */
export function getServerEnv(): OpenRouterEnv {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");

  const providerOrderValue = process.env.OPENROUTER_PROVIDER_ORDER;
  const providerOrder =
    providerOrderValue === undefined
      ? undefined
      : providerOrderValue.split(",").map((provider) => provider.trim());
  if (providerOrder?.some((provider) => !provider)) {
    throw new Error("OPENROUTER_PROVIDER_ORDER must not contain empty entries");
  }

  return {
    openrouterApiKey,
    openrouterModel: process.env.OPENROUTER_MODEL || "z-ai/glm-5.2",
    openrouterProviderOrder: providerOrder,
  };
}

/** D1-only environment access for strongly consistent Story publication. */
export function getD1Env(): CloudflareD1Config | undefined {
  const databaseId = process.env.CF_D1_DATABASE_ID;
  const token = process.env.CF_D1_TOKEN;
  if (!databaseId && !token) return undefined;

  const accountId = process.env.CF_ACCOUNT_ID;
  if (!accountId || !databaseId || !token) {
    throw new Error(
      "D1 requires CF_ACCOUNT_ID, CF_D1_DATABASE_ID, and CF_D1_TOKEN together",
    );
  }
  return { accountId, databaseId, token };
}

/**
 * Langfuse observability credentials. Returns `undefined` when Langfuse is not
 * configured (local dev, CI) so tracing degrades to a no-op; throws on partial
 * configuration to make a misconfigured deployment loud rather than silent.
 * Base URL resolution (`LANGFUSE_BASE_URL`, legacy `LANGFUSE_BASEURL`, EU cloud
 * default) is left to the Langfuse SDK, which reads those variables itself.
 */
export function getLangfuseEnv(): LangfuseEnv | undefined {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  if (!publicKey && !secretKey) return undefined;
  if (!publicKey || !secretKey) {
    throw new Error("Langfuse requires LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY together");
  }
  return { publicKey, secretKey };
}

const MIN_STORY_CACHE_HMAC_KEY_BYTES = 32;

function allowsLocalStoryCredentials(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test" ||
    process.env.PLAYWRIGHT_TEST_MODE === "1"
  );
}

/**
 * Resolve the server-only Story HMAC key. Tests can inject a key directly.
 * Production rejects missing or short secrets rather than creating a
 * dictionary-verifiable cache identity.
 */
export function getStoryCacheHmacKey(injected?: string): string {
  const key = injected?.trim() || process.env.STORY_CACHE_HMAC_KEY?.trim();
  if (key) {
    if (
      process.env.NODE_ENV === "production" &&
      new TextEncoder().encode(key).byteLength < MIN_STORY_CACHE_HMAC_KEY_BYTES
    ) {
      throw new Error("STORY_CACHE_HMAC_KEY must contain at least 32 UTF-8 bytes in production");
    }
    return key;
  }
  if (!allowsLocalStoryCredentials()) throw new Error("Missing STORY_CACHE_HMAC_KEY");
  return "local-only-story-cache-hmac-key";
}

/** Non-secret identifier that makes deliberate HMAC key rotation observable. */
export function getStoryCacheHmacKeyId(): string {
  const keyId = process.env.STORY_CACHE_HMAC_KEY_ID?.trim();
  if (keyId) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(keyId)) {
      throw new Error("STORY_CACHE_HMAC_KEY_ID must be a safe 1-64 character identifier");
    }
    return keyId;
  }
  if (!allowsLocalStoryCredentials()) throw new Error("Missing STORY_CACHE_HMAC_KEY_ID");
  return "local-v1";
}
