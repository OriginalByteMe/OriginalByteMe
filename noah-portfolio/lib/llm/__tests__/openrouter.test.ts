import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getModel } from "@/lib/llm/openrouter";

vi.mock("@openrouter/ai-sdk-provider", () => ({ createOpenRouter: vi.fn() }));

const createOpenRouterMock = vi.mocked(createOpenRouter);
const modelFactory = vi.fn();
const primaryGenerate = vi.fn();
const primaryStream = vi.fn();
const fallbackGenerate = vi.fn();
const fallbackStream = vi.fn();
const fallbackGenerateResult = { content: [] };
const fallbackStreamResult = { stream: new ReadableStream() };
const primaryModel = {
  specificationVersion: "v3" as const,
  provider: "openrouter",
  modelId: "primary",
  supportedUrls: {},
  doGenerate: primaryGenerate,
  doStream: primaryStream,
};
const fallbackModel = {
  specificationVersion: "v3" as const,
  provider: "openrouter",
  modelId: "fallback",
  supportedUrls: {},
  doGenerate: fallbackGenerate,
  doStream: fallbackStream,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  vi.stubEnv("OPENROUTER_MODEL", "");
  vi.stubEnv("OPENROUTER_PROVIDER_ORDER", undefined);
  vi.stubEnv("OPENROUTER_FALLBACK_MODELS", undefined);

  const creditError = Object.assign(new Error("insufficient credits"), { statusCode: 402 });
  primaryGenerate.mockRejectedValue(creditError);
  primaryStream.mockRejectedValue(creditError);
  fallbackGenerate.mockResolvedValue(fallbackGenerateResult);
  fallbackStream.mockResolvedValue(fallbackStreamResult);
  modelFactory.mockImplementation((modelId) =>
    modelId === "tencent/hy3:free" ? fallbackModel : primaryModel,
  );
  createOpenRouterMock.mockReturnValue(modelFactory as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OpenRouter model", () => {
  it("retries generate and stream with the free model after a credit error", async () => {
    const model = getModel();

    await expect(model.doGenerate({} as never)).resolves.toBe(fallbackGenerateResult);
    await expect(model.doStream({} as never)).resolves.toBe(fallbackStreamResult);
    expect(modelFactory).toHaveBeenCalledWith("z-ai/glm-5.2", {
      models: ["tencent/hy3:free"],
    });
    expect(modelFactory).toHaveBeenCalledWith("tencent/hy3:free", undefined);
  });

  it("propagates non-credit errors", async () => {
    const error = new Error("network unavailable");
    primaryGenerate.mockRejectedValue(error);

    await expect(getModel().doGenerate({} as never)).rejects.toBe(error);
    expect(fallbackGenerate).not.toHaveBeenCalled();
  });
});
