export function getServerEnv() {
  const openrouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterApiKey) throw new Error("Missing OPENROUTER_API_KEY");
  const openrouterModel = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-flash";
  const { CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_KV_TOKEN } = process.env;
  const cf = CF_ACCOUNT_ID && CF_KV_NAMESPACE_ID && CF_KV_TOKEN
    ? { accountId: CF_ACCOUNT_ID, namespaceId: CF_KV_NAMESPACE_ID, token: CF_KV_TOKEN }
    : undefined;
  return { openrouterApiKey, openrouterModel, cf };
}
