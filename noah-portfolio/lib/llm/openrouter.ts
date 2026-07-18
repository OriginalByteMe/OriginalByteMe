import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getServerEnv } from "@/lib/env";

/**
 * Build the model for Story generation.
 *
 * Environment is read lazily inside this function, so importing this module
 * never throws when provider credentials are unset.
 */
export function getModel() {
  const env = getServerEnv();
  const openrouter = createOpenRouter({ apiKey: env.openrouterApiKey });
  return env.openrouterProviderOrder
    ? openrouter(env.openrouterModel, { provider: { order: env.openrouterProviderOrder } })
    : openrouter(env.openrouterModel);
}
