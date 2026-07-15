import {
  assertValidPublicStory,
  assertValidStreamPlan,
  assertValidStreamScene,
} from "@/lib/story/public-validation";
import {
  normalizeQuestion,
  StoryStreamEventSchema,
  type EvidenceRef,
  type PublicStory,
  type StoryPhase,
  type StoryPlan,
  type StoryPublicationToken,
  type StoryScene,
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
  onPlan?: (plan: StoryPlan, evidence: EvidenceRef[]) => void;
  onScene?: (scene: StoryScene, scenes: readonly StoryScene[]) => void;
}

const PHASE_INDEX: Record<StoryPhase, number> = {
  planning: 0,
  composing: 1,
  validating: 2,
  publishing: 3,
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
  onPlan,
  onScene,
}: ConsumeStoryStreamOptions): Promise<StoryStreamTerminal> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let phaseIndex = -1;
  let plan: StoryPlan | null = null;
  let evidence: EvidenceRef[] = [];
  const scenes: StoryScene[] = [];
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
            event.phase === "planning"
              ? "The regeneration stream repeated its planning phase."
              : event.phase === "composing"
                ? "The regeneration stream composed before its Plan."
                : event.phase === "validating"
                  ? "The regeneration stream validated before every Scene was ready."
                  : "The regeneration stream published before validation.",
          );
        }
        if (event.phase === "composing" && !plan) {
          throw streamError(
            context,
            "The Story stream started composing before its Plan",
            "The regeneration stream composed before its Plan.",
          );
        }
        if (
          event.phase === "validating" &&
          (!plan || scenes.length !== plan.scenes.length)
        ) {
          throw streamError(
            context,
            "The Story stream started validation before every Scene arrived",
            "The regeneration stream validated before every Scene was ready.",
          );
        }
        phaseIndex = nextPhaseIndex;
        onPhase?.(event.phase);
        return event.phase === "publishing"
          ? { kind: "publish", publicationToken: event.publicationToken }
          : null;
      }
      case "plan":
        if (phaseIndex !== PHASE_INDEX.planning || plan) {
          throw streamError(
            context,
            "The Story stream sent its Plan outside the planning phase",
            "The regeneration stream sent its Plan out of order.",
          );
        }
        assertValidStreamPlan(event.plan, event.evidence, expectedQuestion);
        plan = event.plan;
        evidence = event.evidence;
        onPlan?.(event.plan, event.evidence);
        return null;
      case "scene": {
        if (!plan || phaseIndex !== PHASE_INDEX.composing) {
          throw streamError(
            context,
            "The Story stream sent a Scene outside the composing phase",
            "The regeneration stream sent Scenes out of order.",
          );
        }
        const expectedIndex = scenes.length;
        if (
          event.index !== expectedIndex ||
          event.scene.index !== expectedIndex
        ) {
          throw streamError(
            context,
            "The Story stream sent Scenes out of order",
            "The regeneration stream sent Scenes out of order.",
          );
        }
        const lockedScene = plan.scenes[expectedIndex];
        if (!lockedScene) {
          throw streamError(
            context,
            "The Story stream sent an unplanned Scene",
            "The regeneration stream sent an unplanned Scene.",
          );
        }
        assertValidStreamScene(event.scene, lockedScene, evidence);
        scenes.push(event.scene);
        onScene?.(event.scene, scenes);
        return null;
      }
      case "complete":
        assertValidPublicStory(event.story);
        if (
          phaseIndex !== PHASE_INDEX.validating ||
          !plan ||
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
        if (
          !samePayload(event.story.plan, plan) ||
          !samePayload(event.story.scenes, scenes) ||
          !samePayload(event.story.evidence, evidence)
        ) {
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
