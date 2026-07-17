import type { Spec, JsonPatch } from "@json-render/core";

function escapePointerToken(token: string): string {
  return token.replaceAll("~", "~0").replaceAll("/", "~1");
}

/**
 * Decompose a full spec into one RFC 6902 JSON Patch per element so a
 * renderer can self-assemble it progressively. Shared by the /api/generate
 * patch stream (server) and the client-side "rebuild live" replays
 * (cache-hit answers, returning to the home story).
 */
export function* specToPatches(spec: Spec): Generator<JsonPatch> {
  yield { op: "add", path: "/root", value: spec.root };
  if (spec.state && typeof spec.state === "object" && !Array.isArray(spec.state)) {
    yield { op: "add", path: "/state", value: spec.state };
  }
  for (const [key, element] of Object.entries(spec.elements)) {
    yield { op: "add", path: `/elements/${escapePointerToken(key)}`, value: element };
  }
}
