import {
  assertValidPublicStory,
  assertValidStreamSite,
} from "@/lib/story/public-validation";
import {
  normalizeQuestion,
  StoryStreamEventSchema,
  type EvidenceRef,
  type PublicStory,
  type Site,
  type StoryPhase,
  type StoryPublicationToken,
  type StoryStreamEvent,
} from "@/lib/story/types";

export type StoryStreamTerminal =
  | { kind: "complete"; story: PublicStory }
  | { kind: "publish"; publicationToken: StoryPublicationToken };

type StoryStreamContext = "generation" | "regeneration";

interface ConsumeStoryStreamOptions {
  body: ReadableStream<Uint8Array>;
  expectedQuestion: string;
  context?: StoryStreamContext;
  isActive?: () => boolean;
  onPhase?: (phase: StoryPhase) => void;
  onSite?: (site: Site, evidence: EvidenceRef[]) => void;
}

const PHASE_INDEX: Record<StoryPhase, number> = {
  generating: 0,
  validating: 1,
  publishing: 2,
};

function samePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function parseEvent(
  line: string,
  context: StoryStreamContext,
): StoryStreamEvent | null {
  if (!line.trim()) {
    if (context === "regeneration") return null;
    throw new Error("The Story stream contained an empty event");
  }

  if (context === "regeneration") {
    return StoryStreamEventSchema.parse(JSON.parse(line));
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error("The Story stream contained malformed JSON");
  }

  const result = StoryStreamEventSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("The Story stream contained an invalid event");
  }
  return result.data;
}

function streamError(
  context: StoryStreamContext,
  generation: string,
  regeneration: string,
) {
  return new Error(context === "generation" ? generation : regeneration);
}

/**
 * Consumes and validates the ordered Story NDJSON protocol. Callers only own
 * transport-specific errors and presentation updates; lifecycle invariants live here.
 */
export async function consumeStoryStream({
  body,
  expectedQuestion,
  context = "generation",
  isActive = () => true,
  onPhase,
  onSite,
}: ConsumeStoryStreamOptions): Promise<StoryStreamTerminal> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let phaseIndex = -1;
  let site: Site | null = null;
  let evidence: EvidenceRef[] = [];
  let terminal: StoryStreamTerminal | null = null;

  const consumeLine = (line: string): StoryStreamTerminal | null => {
    if (!isActive()) return null;
    if (terminal) {
      throw new Error("The Story stream continued after its terminal event");
    }

    const event = parseEvent(line, context);
    if (!event) return null;

    switch (event.type) {
      case "phase": {
        const nextPhaseIndex = PHASE_INDEX[event.phase];
        if (nextPhaseIndex !== phaseIndex + 1) {
          throw streamError(
            context,
            "The Story stream sent lifecycle phases out of order",
            event.phase === "generating"
              ? "The regeneration stream repeated its generating phase."
              : event.phase === "validating"
                ? "The regeneration stream validated before its site was ready."
                : "The regeneration stream published before validation.",
          );
        }
        if (event.phase === "validating" && !site) {
          throw streamError(
            context,
            "The Story stream started validation before its site arrived",
            "The regeneration stream validated before its site was ready.",
          );
        }
        phaseIndex = nextPhaseIndex;
        onPhase?.(event.phase);
        return event.phase === "publishing"
          ? { kind: "publish", publicationToken: event.publicationToken }
          : null;
      }
      case "site":
        if (phaseIndex !== PHASE_INDEX.generating || site) {
          throw streamError(
            context,
            "The Story stream sent its site outside the generating phase",
            "The regeneration stream sent its site out of order.",
          );
        }
        assertValidStreamSite(event.site, event.evidence);
        site = event.site;
        evidence = event.evidence;
        onSite?.(event.site, event.evidence);
        return null;
      case "complete":
        assertValidPublicStory(event.story);
        if (
          phaseIndex !== PHASE_INDEX.validating ||
          !site ||
          (context === "generation" &&
            normalizeQuestion(event.story.displayQuestion) !==
              normalizeQuestion(expectedQuestion))
        ) {
          throw streamError(
            context,
            "The cached Story bypassed its validated lifecycle",
            "The completed Story did not match its validated stream.",
          );
        }
        if (!samePayload(event.story.site, site) || !samePayload(event.story.evidence, evidence)) {
          throw streamError(
            context,
            "The cached Story did not match its replayed draft",
            "The completed Story did not match its validated stream.",
          );
        }
        return { kind: "complete", story: event.story };
      case "error":
        throw new Error(event.message);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const nextTerminal = consumeLine(line);
      if (nextTerminal) {
        terminal = nextTerminal;
        if (context === "regeneration") {
          await reader.cancel();
          return terminal;
        }
      }
    }
    if (done) break;
  }

  if (buffer) {
    const nextTerminal = consumeLine(buffer);
    if (nextTerminal) terminal = nextTerminal;
  }
  if (terminal) return terminal;

  throw new Error(
    context === "generation"
      ? "The Story stream ended before publication"
      : "The regeneration stream ended before the Story was ready.",
  );
}
