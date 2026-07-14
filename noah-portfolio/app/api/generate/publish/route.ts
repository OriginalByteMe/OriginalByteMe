import { NextRequest, NextResponse } from "next/server";
import { publishPreparedStory } from "@/lib/story/store";
import {
  PublishStoryRequestSchema,
  PublishStoryResponseSchema,
  toPublicStory,
} from "@/lib/story/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const CANCELED_RESPONSE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};


export async function POST(req: NextRequest): Promise<Response> {
  if (req.signal.aborted) {
    return new Response(null, { status: 499, headers: CANCELED_RESPONSE_HEADERS });
  }

  const body: unknown = await req.json().catch(() => null);
  const parsed = PublishStoryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "publicationToken must be a valid Story publication token" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const story = await publishPreparedStory(parsed.data.publicationToken, {
      signal: req.signal,
    });
    req.signal.throwIfAborted();
    const response = PublishStoryResponseSchema.parse({
      type: "complete",
      story: toPublicStory(story),
    });
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (req.signal.aborted) {
      return new Response(null, { status: 499, headers: CANCELED_RESPONSE_HEADERS });
    }

    const detail = error instanceof Error ? error.message : "";
    if (/expired/i.test(detail)) {
      return NextResponse.json(
        { error: "Story publication token has expired" },
        { status: 410, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (/not recognized|invalid.*signature/i.test(detail)) {
      return NextResponse.json(
        { error: "Story publication token is not recognized" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Failed to publish Story" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
