import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Spec, JsonPatch } from "@json-render/core";
import { createSpecStreamCompiler } from "@json-render/core";

vi.mock("ai", () => ({ streamText: vi.fn() }));
vi.mock("@/lib/llm/openrouter", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/cache/kv", () => ({ kvGet: vi.fn(), kvPut: vi.fn() }));

import { streamText } from "ai";
import { getModel } from "@/lib/llm/openrouter";
import { kvGet, kvPut } from "@/lib/cache/kv";
import { cacheKey } from "@/lib/cache/key";
import { POST } from "@/app/api/generate/route";

const streamTextMock = vi.mocked(streamText);
const getModelMock = vi.mocked(getModel);
const kvGetMock = vi.mocked(kvGet);
const kvPutMock = vi.mocked(kvPut);

/** Minimal but structurally-valid spec accepted by validateSpec/autoFixSpec. */
const VALID_SPEC: Spec = {
  root: "main",
  state: { "/backdrop/preset": "nightMatte" },
  elements: {
    main: { type: "Prose", props: { text: "Hi, I'm Noah." }, children: [] },
  },
};

function streamResult(text: string) {
  return {
    textStream: (async function* () {
      // Yield in small chunks to exercise the streaming path.
      const chunkSize = 5;
      for (let i = 0; i < text.length; i += chunkSize) {
        yield text.slice(i, i + chunkSize);
      }
    })(),
  } as never;
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function readStreamPatches(res: Response): Promise<JsonPatch[]> {
  const reader = res.body?.getReader();
  if (!reader) return [];
  const decoder = new TextDecoder();
  let buffer = "";
  const patches: JsonPatch[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      patches.push(JSON.parse(line.trim()) as JsonPatch);
    }
  }
  if (buffer.trim()) {
    patches.push(JSON.parse(buffer.trim()) as JsonPatch);
  }
  return patches;
}

async function streamToSpec(res: Response): Promise<Spec> {
  const patches = await readStreamPatches(res);
  const compiler = createSpecStreamCompiler<Spec>({ root: "", elements: {} });
  for (const patch of patches) {
    compiler.push(JSON.stringify(patch) + "\n");
  }
  return compiler.getResult();
}

beforeEach(() => {
  vi.resetAllMocks();
  getModelMock.mockReturnValue({} as never);
  kvGetMock.mockResolvedValue(null);
  kvPutMock.mockResolvedValue(undefined);
});

describe("POST /api/generate", () => {
  it("rejects an empty question with 400", async () => {
    const res = await POST(postRequest({ question: "" }));
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(body && typeof body === "object" && "error" in body && typeof body.error === "string").toBe(true);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects a question over 280 characters with 400", async () => {
    const res = await POST(postRequest({ question: "a".repeat(281) }));
    expect(res.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string question with 400", async () => {
    const res = await POST(postRequest({ question: 42 }));
    expect(res.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("returns the cached spec on a cache hit without calling the model", async () => {
    const question = "What have you built?";
    kvGetMock.mockResolvedValue(JSON.stringify({ spec: VALID_SPEC }));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-cache")).toBe("hit");
    const body: unknown = await res.json();
    expect(body && typeof body === "object" && "spec" in body && body.spec).toEqual(VALID_SPEC);
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(kvGetMock).toHaveBeenCalledWith(cacheKey(question));
  });

  it("on a cache miss with a valid first output, streams patches and writes the cache", async () => {
    const question = "What have you built?";
    streamTextMock.mockResolvedValueOnce(streamResult(JSON.stringify(VALID_SPEC)));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-cache")).toBe("miss");
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");

    const streamedSpec = await streamToSpec(res);
    expect(streamedSpec).toEqual(VALID_SPEC);
    expect(streamedSpec.state?.["/backdrop/preset"]).toBe("nightMatte");

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(kvPutMock).toHaveBeenCalledTimes(1);
    const [putKey, putValue] = kvPutMock.mock.calls[0];
    expect(putKey).toBe(cacheKey(question));
    expect(JSON.parse(putValue as string)).toEqual({ spec: VALID_SPEC });
  });

  it("escapes element keys as RFC 6901 pointer tokens in the patch stream", async () => {
    const pointerSpec: Spec = {
      ...VALID_SPEC,
      root: "main/intro~",
      elements: {
        "main/intro~": VALID_SPEC.elements.main,
      },
    };
    streamTextMock.mockResolvedValueOnce(streamResult(JSON.stringify(pointerSpec)));

    const res = await POST(postRequest({ question: "What have you built?" }));

    expect(await streamToSpec(res)).toEqual(pointerSpec);
  });

  it("retries once when the first output is invalid JSON, then succeeds", async () => {
    const question = "What have you built?";
    streamTextMock
      .mockResolvedValueOnce(streamResult("not valid json at all"))
      .mockResolvedValueOnce(streamResult(JSON.stringify(VALID_SPEC)));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(200);
    const streamedSpec = await streamToSpec(res);
    expect(streamedSpec).toEqual(VALID_SPEC);
    expect(streamTextMock).toHaveBeenCalledTimes(2);

    // The retry message fed back to the model must carry the prior bad output + an error string.
    const secondCall = streamTextMock.mock.calls[1];
    expect(secondCall).toBeDefined();
    const secondCallArgs = secondCall[0];
    expect(secondCallArgs && typeof secondCallArgs === "object" && "messages" in secondCallArgs).toBe(true);
    const messages = secondCallArgs.messages;
    if (!Array.isArray(messages)) throw new Error("Expected messages array");
    const roles = messages.map((m) => (m && typeof m === "object" && "role" in m ? String(m.role) : ""));
    // The system prompt travels via streamText's dedicated `system` option
    // (not a messages entry), so the retry transcript is user/assistant/user.
    expect(roles).toEqual(["user", "assistant", "user"]);
    expect(typeof secondCallArgs.system).toBe("string");
    expect(messages[1].content).toBe("not valid json at all");
    expect(messages[2].content).toMatch(/invalid/i);
  });

  it("returns 422 with no cache write after 3 consecutive invalid outputs", async () => {
    const question = "What have you built?";
    streamTextMock.mockResolvedValue(streamResult("still not json"));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(422);
    const body: unknown = await res.json();
    expect(body && typeof body === "object" && "error" in body && typeof body.error === "string").toBe(true);
    expect(streamTextMock).toHaveBeenCalledTimes(3);
    expect(kvPutMock).not.toHaveBeenCalled();
  });

  it("returns 500 when an unexpected error occurs", async () => {
    const question = "What have you built?";
    kvGetMock.mockRejectedValue(new Error("KV is down"));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(500);
    const body: unknown = await res.json();
    expect(body && typeof body === "object" && "error" in body && typeof body.error === "string").toBe(true);
  });
});
