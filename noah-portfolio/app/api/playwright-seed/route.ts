import { seedStoryFixtures } from "@/lib/story/store";

export const runtime = "nodejs";

/** Test-only bridge that seeds the Next server process from Playwright global setup. */
export async function POST(request: Request): Promise<Response> {
  if (process.env.PLAYWRIGHT_TEST_MODE !== "1") {
    return new Response(null, { status: 404 });
  }

  const fixtures: unknown = await request.json().catch(() => null);
  try {
    seedStoryFixtures(fixtures);
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Invalid Story fixtures" }, { status: 400 });
  }
}
