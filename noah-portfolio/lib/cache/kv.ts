import { getServerEnv } from "@/lib/env";

type CfConfig = { accountId: string; namespaceId: string; token: string };

function kvBaseUrl(cf: CfConfig): string {
  return `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/storage/kv/namespaces/${cf.namespaceId}/values`;
}

/** Read a cached value from CF KV. No-op (returns null) when CF credentials aren't configured. */
export async function kvGet(key: string): Promise<string | null> {
  const { cf } = getServerEnv();
  if (!cf) return null;
  const res = await fetch(`${kvBaseUrl(cf)}/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cf.token}` },
  });
  return res.ok ? res.text() : null;
}

/** Write a value to CF KV. No-op when CF credentials aren't configured. */
export async function kvPut(key: string, value: string): Promise<void> {
  const { cf } = getServerEnv();
  if (!cf) return;
  await fetch(`${kvBaseUrl(cf)}/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${cf.token}` },
    body: value,
  });
}
