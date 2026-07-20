import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  type LanguageModelMiddleware as LanguageModelV3Middleware,
  wrapLanguageModel,
} from "ai";
import { getServerEnv } from "@/lib/env";

function isCreditError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (("statusCode" in error && error.statusCode === 402) ||
      ("message" in error &&
        typeof error.message === "string" &&
        /insufficient credits|payment required/i.test(error.message)))
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
  const openrouter = createOpenRouter({ apiKey: env.openrouterApiKey });
  const primaryModel =
    !env.openrouterProviderOrder && !env.openrouterFallbackModels
      ? openrouter(env.openrouterModel)
      : openrouter(env.openrouterModel, {
          ...(env.openrouterProviderOrder && {
            provider: { order: env.openrouterProviderOrder },
          }),
          ...(env.openrouterFallbackModels && { models: env.openrouterFallbackModels }),
        });

  if (!env.openrouterFallbackModels) return primaryModel;

  const fallbackModels = env.openrouterFallbackModels;
  const fallbackModel = openrouter(
    fallbackModels[0],
    fallbackModels.length > 1 ? { models: fallbackModels.slice(1) } : undefined,
  );
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
