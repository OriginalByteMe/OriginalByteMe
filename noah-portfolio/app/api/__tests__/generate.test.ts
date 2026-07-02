import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/llm/openrouter", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/cache/kv", () => ({ kvGet: vi.fn(), kvPut: vi.fn() }));

import { generateText } from "ai";
import { getModel } from "@/lib/llm/openrouter";
import { kvGet, kvPut } from "@/lib/cache/kv";
import { cacheKey } from "@/lib/cache/key";
import { POST } from "@/app/api/generate/route";

const generateTextMock = vi.mocked(generateText);
const getModelMock = vi.mocked(getModel);
const kvGetMock = vi.mocked(kvGet);
const kvPutMock = vi.mocked(kvPut);

/** Minimal but structurally-valid spec accepted by validateSpec/autoFixSpec. */
const VALID_SPEC = { root: "main", elements: { main: { type: "Prose", props: { text: "Hi, I'm Noah." }, children: [] } } };

function textResult(text: string) {
  return { text } as never;
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generate", { method: "POST", body: JSON.stringify(body) });
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
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("rejects a question over 280 characters with 400", async () => {
    const res = await POST(postRequest({ question: "a".repeat(281) }));
    expect(res.status).toBe(400);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("rejects a non-string question with 400", async () => {
    const res = await POST(postRequest({ question: 42 }));
    expect(res.status).toBe(400);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("returns the cached spec on a cache hit without calling the model", async () => {
    const question = "What have you built?";
    kvGetMock.mockResolvedValue(JSON.stringify({ spec: VALID_SPEC }));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-cache")).toBe("hit");
    const body = await res.json();
    expect(body.spec).toEqual(VALID_SPEC);
    expect(generateTextMock).not.toHaveBeenCalled();
    expect(kvGetMock).toHaveBeenCalledWith(cacheKey(question));
  });

  it("on a cache miss with a valid first output, returns the spec and writes the cache", async () => {
    const question = "What have you built?";
    generateTextMock.mockResolvedValueOnce(textResult(JSON.stringify(VALID_SPEC)));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(200);
    expect(res.headers.get("x-cache")).toBe("miss");
    const body = await res.json();
    expect(body.spec).toEqual(VALID_SPEC);
    expect(generateTextMock).toHaveBeenCalledTimes(1);
    expect(kvPutMock).toHaveBeenCalledTimes(1);
    const [putKey, putValue] = kvPutMock.mock.calls[0];
    expect(putKey).toBe(cacheKey(question));
    expect(JSON.parse(putValue)).toEqual({ spec: VALID_SPEC });
  });

  it("retries once when the first output is invalid JSON, then succeeds", async () => {
    const question = "What have you built?";
    generateTextMock.mockResolvedValueOnce(textResult("not valid json at all"));
    generateTextMock.mockResolvedValueOnce(textResult(JSON.stringify(VALID_SPEC)));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spec).toEqual(VALID_SPEC);
    expect(generateTextMock).toHaveBeenCalledTimes(2);

    // The retry message fed back to the model must carry the prior bad output + an error string.
    const secondCallArgs = generateTextMock.mock.calls[1][0] as { messages: Array<{ role: string; content: string }> };
    const roles = secondCallArgs.messages.map((m) => m.role);
    expect(roles).toEqual(["system", "user", "assistant", "user"]);
    expect(secondCallArgs.messages[2].content).toBe("not valid json at all");
    expect(secondCallArgs.messages[3].content).toMatch(/invalid/i);
  });

  it("returns 422 with no cache write after 3 consecutive invalid outputs", async () => {
    const question = "What have you built?";
    generateTextMock.mockResolvedValue(textResult("still not json"));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(generateTextMock).toHaveBeenCalledTimes(3);
    expect(kvPutMock).not.toHaveBeenCalled();
  });

  it("returns 500 when an unexpected error occurs", async () => {
    const question = "What have you built?";
    kvGetMock.mockRejectedValue(new Error("KV is down"));

    const res = await POST(postRequest({ question }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
