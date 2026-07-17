/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * Registers the Langfuse OpenTelemetry span processor so Story generations are
 * traced. No-op when Langfuse credentials are absent.
 */
export async function register(): Promise<void> {
  // Platform-specific module: the Langfuse processor pulls in node-only OTel
  // packages (@opentelemetry/sdk-trace-node) that must never load in the Edge
  // runtime, so a static import is not possible here. `register()` runs in
  // every runtime; only wire tracing in Node.js, where the generation route runs.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerLangfuseTracing } = await import("./lib/observability/langfuse");
    registerLangfuseTracing();
  }
}
