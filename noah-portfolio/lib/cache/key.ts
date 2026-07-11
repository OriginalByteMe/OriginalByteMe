import { CATALOG_VERSION } from "@/lib/jsonui/catalogVersion";

/** Lowercase + trim + collapse internal whitespace so near-duplicate questions share a cache entry. */
export function normalizeQuestion(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cache key namespaced by catalog version so a catalog change invalidates old cached specs. */
export function cacheKey(q: string): string {
  return `${normalizeQuestion(q)}:${CATALOG_VERSION}`;
}
