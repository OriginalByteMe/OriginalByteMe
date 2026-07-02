import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getServerEnv } from "@/lib/env";

/**
 * Build the OpenRouter chat model to use for spec generation.
 *
 * `getServerEnv()` is called lazily (inside this function, not at module
 * scope) so importing this module never throws when `OPENROUTER_API_KEY`
 * is unset — only calling `getModel()` does.
 */
export function getModel() {
  const env = getServerEnv();
  return createOpenRouter({ apiKey: env.openrouterApiKey })(env.openrouterModel);
}
