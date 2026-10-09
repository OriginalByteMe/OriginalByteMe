import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  type LanguageModelMiddleware as LanguageModelV3Middleware,
  wrapLanguageModel,
} from "ai";
import { getServerEnv } from "@/lib/env";

function isCreditError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // An explicit status code is authoritative: only 402 is a credit error.
  if ("statusCode" in error && error.statusCode !== undefined) {
    return error.statusCode === 402;
  }
  return (
    "message" in error &&
    typeof error.message === "string" &&
    /insufficient credits|payment required/i.test(error.message)
  );
}

/**
 * Build the model for Story generation.
 *
 * Environment is read lazily inside this function, so importing this module
 * never throws when provider credentials are unset.
 * `models` configures OpenRouter's server-side fallback chain when the primary errors, e.g. insufficient credits.
 */
export function getModel() {
  const env = getServerEnv();
  const openrouter = createOpenRouter({
    apiKey: env.openrouterApiKey,
    // "strict" sends stream_options.include_usage, so OpenAI-compatible endpoints report token usage too.
    compatibility: "strict",
    ...(env.openrouterBaseUrl && { baseURL: env.openrouterBaseUrl }),
  });
  const shared = {
    // The site schema has optional fields, which OpenAI-style strict schemas reject; send it as a guide.
    structuredOutputs: { strict: false },
    ...(env.openrouterReasoningEffort && { reasoning: { effort: env.openrouterReasoningEffort } }),
  };
  const primaryModel = openrouter(env.openrouterModel, {
    ...(env.openrouterProviderOrder && {
      provider: { order: env.openrouterProviderOrder },
    }),
    ...(env.openrouterFallbackModels && { models: env.openrouterFallbackModels }),
    ...shared,
  });

  if (!env.openrouterFallbackModels) return primaryModel;

  const fallbackModels = env.openrouterFallbackModels;
  const fallbackModel = openrouter(fallbackModels[0], {
    ...(fallbackModels.length > 1 && { models: fallbackModels.slice(1) }),
    ...shared,
  });
  // App-level 402 retry: OpenRouter's server-side `models` fallback is not
  // documented to cover zero-balance 402.
  const creditFallbackMiddleware: LanguageModelV3Middleware = {
    specificationVersion: "v3",
    wrapGenerate: async ({ doGenerate, params }) => {
      try {
        return await doGenerate();
      } catch (error) {
        if (!isCreditError(error)) throw error;
        return fallbackModel.doGenerate(params);
      }
    },
    wrapStream: async ({ doStream, params }) => {
      try {
        return await doStream();
      } catch (error) {
        if (!isCreditError(error)) throw error;
        return fallbackModel.doStream(params);
      }
    },
  };
  return wrapLanguageModel({ model: primaryModel, middleware: creditFallbackMiddleware });
}
