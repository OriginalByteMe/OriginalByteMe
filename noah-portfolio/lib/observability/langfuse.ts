import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
  propagateAttributes,
  startActiveObservation,
  type LangfuseSpan,
} from "@langfuse/tracing";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import type { TelemetrySettings } from "ai";
import { getLangfuseEnv } from "@/lib/env";

/**
 * Langfuse tracing for Story generation, built on the Vercel AI SDK's native
 * OpenTelemetry instrumentation.
 *
 * The whole pipeline is opt-in: when `LANGFUSE_*` credentials are absent (local
 * dev, CI, tests) every export here degrades to a no-op so nothing changes and
 * nothing throws. When credentials are present, each `streamText` call the route
 * makes with `storyTelemetry(...)` emits an OTel generation span, and
 * `withStoryTrace(...)` groups the plan plus every scene of one question into a
 * single Langfuse trace.
 */

/**
 * The span processor is created once at server start (via `instrumentation.ts`)
 * and retained so the generation route can force-flush it before a serverless
 * invocation freezes — otherwise buffered spans are dropped.
 *
 * Next.js compiles `instrumentation.ts` and route handlers as separate
 * entrypoints, which can give each its own copy of this module's scope. A
 * plain module-level `let` would let the route see `processor === undefined`
 * and silently skip the flush. Keying the singleton off `globalThis` makes the
 * registered processor reachable from every bundle in the same Node process.
 */
const REGISTRY_KEY = Symbol.for("noah-portfolio.langfuse.processor");

type LangfuseRegistry = { processor?: LangfuseSpanProcessor };

const globalRegistry = globalThis as typeof globalThis & {
  [REGISTRY_KEY]?: LangfuseRegistry;
};

const registry: LangfuseRegistry = (globalRegistry[REGISTRY_KEY] ??= {});

function isLangfuseEnabled(): boolean {
  return getLangfuseEnv() !== undefined;
}

/**
 * Register the Langfuse span processor with a Node tracer provider. Idempotent
 * and safe to call when Langfuse is unconfigured (it simply does nothing).
 * Invoked from the Next.js instrumentation hook in the Node.js runtime only.
 */
export function registerLangfuseTracing(): void {
  if (registry.processor) return;
  const env = getLangfuseEnv();
  if (!env) return;

  registry.processor = new LangfuseSpanProcessor({
    publicKey: env.publicKey,
    secretKey: env.secretKey,
  });
  new NodeTracerProvider({ spanProcessors: [registry.processor] }).register();
}

/**
 * Telemetry settings for a single `streamText` call. `functionId` becomes the
 * span name in Langfuse (e.g. `story-plan`, `story-scene`); `metadata` adds
 * filterable dimensions such as the attempt number and scene index. Returns a
 * disabled setting when Langfuse is not configured, so the AI SDK skips
 * emitting spans entirely.
 */
export function storyTelemetry(
  functionId: string,
  metadata?: Record<string, string | number | boolean>,
): TelemetrySettings {
  if (!isLangfuseEnabled()) return { isEnabled: false };
  return { isEnabled: true, functionId, ...(metadata ? { metadata } : {}) };
}

/** Root-trace handle handed to the generation pipeline to record its result. */
export interface StoryTrace {
  /** Set the trace-level output (Story id, scene count, error). */
  setOutput(output: unknown): void;
}

const NOOP_TRACE: StoryTrace = { setOutput() {} };

/**
 * Run `fn` inside one Langfuse trace named `story-generation`, with `question`
 * as the trace input. All `streamText` generation spans created inside nest
 * under the trace's root span via OpenTelemetry context propagation. The
 * processor is force-flushed once the root span ends so spans survive a
 * serverless freeze. When Langfuse is disabled `fn` runs directly against a
 * no-op trace.
 */
export async function withStoryTrace<T>(
  question: string,
  fn: (trace: StoryTrace) => Promise<T>,
): Promise<T> {
  if (!isLangfuseEnabled()) return fn(NOOP_TRACE);

  try {
    return await propagateAttributes(
      { traceName: "story-generation", tags: ["story-generation"] },
      () =>
        startActiveObservation("story-generation", async (span: LangfuseSpan) => {
          span.update({ input: { question } });
          return fn({ setOutput: (output) => span.update({ output }) });
        }),
    );
  } finally {
    // Observability must never break the response path: a failed span export is
    // logged and swallowed so it can neither replace a successful generation nor
    // mask the real generation error propagating out of the try.
    try {
      await registry.processor?.forceFlush();
    } catch (flushError) {
      console.error("Langfuse span flush failed", flushError);
    }
  }
}
