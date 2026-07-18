import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StoryExperience from "@/components/story/StoryExperience";
import { CORPUS_EVIDENCE_REFS } from "@/lib/story/evidence";
import type { PublicStory, StoryPlan, StoryScene } from "@/lib/story/types";

const motionState = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: { div: "div" },
  useReducedMotion: () => motionState.reducedMotion,
}));

vi.mock("@/components/story/MotionAsset", () => ({
  MotionAsset: ({ assetId }: { assetId: string }) => (
    <div data-testid="motion-asset" data-asset-id={assetId}>
      Curated motion: {assetId}
    </div>
  ),
}));

vi.mock("@/components/story/remotion/RemotionScene", () => ({
  RemotionScene: ({ fallback }: { fallback: ReactNode }) => (
    <div data-testid="remotion-scene">{fallback}</div>
  ),
}));

vi.mock("@/components/story/SceneTransition", () => ({
  SceneTransition: ({
    index,
    seed,
    from,
    to,
  }: {
    index: number;
    seed: string;
    from: StoryScene;
    to: StoryScene;
  }) => (
    <div
      data-testid="scene-transition"
      data-index={index}
      data-seed={seed}
      data-from={from.id}
      data-to={to.id}
    />
  ),
}));

const EVIDENCE = [CORPUS_EVIDENCE_REFS[0], CORPUS_EVIDENCE_REFS[1]];
const QUESTION = "How does Noah approach production systems?";

function makePlan(): StoryPlan {
  return {
    question: QUESTION,
    mode: "grounded",
    backdropPreset: "ditherIndigo",
    relatedQuestions: [
      "Which systems has Noah designed?",
      "How does Noah validate delivery work?",
    ],
    scenes: [
      {
        id: "direct-answer",
        index: 0,
        role: "direct-answer",
        pattern: "hero-statement",
        register: "editorial",
        title: "Start with the operating truth",
        claim: "Noah connects product craft to dependable operation.",
        assetId: "circuit-mind",
        evidenceRefIds: [EVIDENCE[0].id],
        cue: { phase: "intro", focus: "center", intensity: "quiet" },
      },
      {
        id: "grounded-evidence",
        index: 1,
        role: "evidence",
        pattern: "evidence-ledger",
        register: "technical",
        title: "Trace decisions to evidence",
        claim: "Visible references keep the technical narrative accountable.",
        assetId: "print-layers",
        evidenceRefIds: EVIDENCE.map((reference) => reference.id),
        cue: { phase: "develop", focus: "left", intensity: "strong" },
      },
      {
        id: "useful-synthesis",
        index: 2,
        role: "synthesis",
        pattern: "closing-synthesis",
        register: "reflective",
        title: "Build for the life after launch",
        claim: "The outcome is software that remains useful in production.",
        assetId: "morning-coffee",
        evidenceRefIds: [EVIDENCE[1].id],
        cue: { phase: "resolve", focus: "right", intensity: "medium" },
      },
    ],
  };
}

function makeScenes(plan: StoryPlan): StoryScene[] {
  return plan.scenes.map((scene, index) => ({
    ...scene,
    body:
      index === 1
        ? "The evidence is visible in semantic text. Both references remain readable without animation."
        : "The required meaning stays in this semantic explanation, including in reduced-motion mode.",
  }));
}

function makeStory(plan = makePlan()): PublicStory {
  return {
    id: "AbCdEfGhIjKlMnOpQrStUvWx",
    displayQuestion: QUESTION,
    createdAt: "2026-07-14T08:00:00.000Z",
    plan,
    scenes: makeScenes(plan),
    evidence: [...EVIDENCE],
  };
}

let intersectionCallback: IntersectionObserverCallback | null = null;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
}

beforeEach(() => {
  intersectionCallback = null;
  motionState.reducedMotion = false;
  vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("StoryExperience", () => {
  it("whispers phase and Scene progress in side pills, then removes them on completion", () => {
    vi.useFakeTimers();
    const plan = makePlan();
    const scenes = makeScenes(plan);
    const common = {
      question: QUESTION,
      evidence: [...EVIDENCE],
      story: null,
      error: null,
      onRetry: vi.fn(),
      onRelatedQuestion: vi.fn(),
    };
    const { rerender } = render(
      <StoryExperience {...common} phase="planning" plan={null} scenes={[]} />,
    );

    expect(screen.getByRole("heading", { name: "Preparing your Story" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Story preparation" })).toHaveTextContent(
      "Let me think about Noah",
    );
    expect(document.querySelector(".story-phrase__typed")).toHaveTextContent("");
    expect(
      within(screen.getByRole("group", { name: "Story generation progress" })).getByText(
        "Planning the Story",
      ),
    ).toBeInTheDocument();
    expect(document.querySelector(".story-prelude__phase")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share this Story" })).not.toBeInTheDocument();

    rerender(
      <StoryExperience {...common} phase="planning" plan={plan} scenes={[]} />,
    );

    expect(screen.queryByText("Preparing your Story")).not.toBeInTheDocument();
    expect(document.querySelector(".story-blueprint")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Planned Story scenes" })).not.toBeInTheDocument();

    rerender(
      <StoryExperience
        {...common}
        phase="composing"
        plan={plan}
        scenes={[scenes[0]]}
      />,
    );

    const pills = screen.getByRole("group", { name: "Story generation progress" });
    expect(within(pills).getByText("Composing Scenes")).toBeInTheDocument();
    expect(
      within(pills).getByText("Composed 1 of 3 — Start with the operating truth"),
    ).toBeInTheDocument();
    expect(pills.querySelectorAll(".story-phase-pill")).toHaveLength(2);
    expect(pills.querySelector(".story-phase-pill--scene")).toHaveAttribute(
      "data-state",
      "ready",
    );
    expect(screen.getByRole("status", { name: "Story generation status" })).toHaveTextContent(
      "1 of 3 planned Scenes ready. Composing Trace decisions to evidence",
    );

    act(() => vi.advanceTimersByTime(1200));
    expect(
      within(pills).getByText("Composing 2 of 3 — Trace decisions to evidence"),
    ).toBeInTheDocument();
    expect(pills.querySelector(".story-phase-pill--scene")).toHaveAttribute(
      "data-state",
      "composing",
    );

    const sceneSections = document.querySelectorAll("section[data-story-scene]");
    expect(sceneSections).toHaveLength(1);
    expect(sceneSections[0]).toHaveClass("story-scene");
    expect(screen.getByRole("heading", { name: scenes[0].title })).toBeInTheDocument();
    expect(screen.getAllByTestId("remotion-scene")).toHaveLength(1);
    expect(screen.getAllByTestId("motion-asset")).toHaveLength(1);
    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
    expect(screen.getByText("Composing Scene 2 of 3")).toBeInTheDocument();

    const story = makeStory(plan);
    rerender(
      <StoryExperience
        {...common}
        phase="publishing"
        plan={story.plan}
        scenes={story.scenes}
        story={story}
      />,
    );

    expect(
      screen.queryByRole("group", { name: "Story generation progress" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Story generation status" })).not.toBeInTheDocument();
    expect(document.querySelector(".story-phase-pill")).not.toBeInTheDocument();
  });

  it("renders a complete single-scene Story without a transition or synthesis", () => {
    const plan = makePlan();
    plan.mode = "boundary";
    plan.scenes[0].evidenceRefIds = [];
    plan.scenes = [plan.scenes[0]];
    const story = makeStory(plan);
    story.evidence = [];

    render(
      <StoryExperience
        question={QUESTION}
        phase="publishing"
        plan={story.plan}
        scenes={story.scenes}
        evidence={story.evidence}
        story={story}
        error={null}
        onRetry={vi.fn()}
        onRelatedQuestion={vi.fn()}
      />,
    );

    expect(document.querySelectorAll("section[data-story-scene]")).toHaveLength(1);
    expect(screen.getByRole("navigation", { name: "Story scenes" }).querySelectorAll("li")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Sources for this claim" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Grounded in 0 evidence references/i)).not.toBeInTheDocument();
    expect(screen.getByText("1 of 1 ready")).toBeInTheDocument();
    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
    expect(screen.getByText("Direct answer")).toBeInTheDocument();
    expect(screen.queryByText("Synthesis")).not.toBeInTheDocument();
  });

  it("swaps complete Prelude phrases without typewriter motion when reduced motion is preferred", async () => {
    motionState.reducedMotion = true;

    render(
      <StoryExperience
        question={QUESTION}
        phase="planning"
        plan={null}
        scenes={[]}
        evidence={[...EVIDENCE]}
        story={null}
        error={null}
        onRetry={vi.fn()}
        onRelatedQuestion={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(document.querySelector(".story-phrase__typed")).toHaveTextContent(
        "Let me think about Noah…",
      ),
    );
    expect(document.querySelector(".story-phrase")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
  });

  it("renders claim-anchored source popovers, Motion Assets, sharing, and final questions", async () => {
    const story = makeStory();
    const onRelatedQuestion = vi.fn();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });

    render(
      <StoryExperience
        question={QUESTION}
        phase="publishing"
        plan={story.plan}
        scenes={story.scenes}
        evidence={story.evidence}
        story={story}
        error={null}
        onRetry={vi.fn()}
        onRelatedQuestion={onRelatedQuestion}
      />,
    );

    const sections = document.querySelectorAll<HTMLElement>("section[data-story-scene]");
    expect(sections).toHaveLength(3);
    sections.forEach((section) => expect(section).toHaveClass("story-scene"));
    story.scenes.forEach((scene, index) => {
      expect(
        within(sections[index]).getByRole("heading", { level: 2, name: scene.title }),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByTestId("scene-transition")).toHaveLength(2);
    expect(screen.getAllByTestId("scene-transition").map((transition) => ({
      index: transition.dataset.index,
      seed: transition.dataset.seed,
      from: transition.dataset.from,
      to: transition.dataset.to,
    }))).toEqual([
      {
        index: "1",
        seed: story.plan.question,
        from: story.scenes[0].id,
        to: story.scenes[1].id,
      },
      {
        index: "2",
        seed: story.plan.question,
        from: story.scenes[1].id,
        to: story.scenes[2].id,
      },
    ]);
    expect(screen.getAllByTestId("motion-asset")).toHaveLength(3);
    expect(screen.getAllByTestId("motion-asset").map((asset) => asset.dataset.assetId)).toEqual([
      "circuit-mind",
      "print-layers",
      "morning-coffee",
    ]);

    expect(screen.queryByRole("complementary", { name: /Evidence for/ })).not.toBeInTheDocument();
    expect(screen.queryByText(EVIDENCE[0].label)).not.toBeInTheDocument();
    const firstScene = sections[0];
    const claim = within(firstScene).getByText(story.scenes[0].claim);
    const sourceTrigger = within(firstScene).getByRole("button", {
      name: "Sources for this claim",
    });
    expect(firstScene.querySelector(".story-scene__stage")).toContainElement(sourceTrigger);
    expect(claim.closest(".story-scene__detail")).toBeInTheDocument();

    act(() => sourceTrigger.focus());
    let sourcePopover = within(firstScene).getByRole("dialog", {
      name: "Sources for this claim",
    });
    expect(sourceTrigger).toHaveAttribute("aria-expanded", "true");
    expect(within(sourcePopover).getByText(EVIDENCE[0].label)).toBeInTheDocument();
    expect(within(sourcePopover).getByText(EVIDENCE[0].excerpt)).toBeInTheDocument();
    expect(within(sourcePopover).queryByText(EVIDENCE[0].path)).not.toBeInTheDocument();

    fireEvent.keyDown(sourceTrigger, { key: "Escape" });
    expect(sourceTrigger).toHaveFocus();
    expect(within(firstScene).queryByRole("dialog")).not.toBeInTheDocument();

    const sourceAnchor = sourceTrigger.closest(".story-sources");
    expect(sourceAnchor).not.toBeNull();
    fireEvent.mouseEnter(sourceAnchor!);
    expect(within(firstScene).getByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseLeave(sourceAnchor!);
    expect(within(firstScene).queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(sourceTrigger);
    sourcePopover = within(firstScene).getByRole("dialog");
    expect(sourcePopover).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(within(firstScene).queryByRole("dialog")).not.toBeInTheDocument();

    const shareButton = screen.getByRole("button", { name: "Share this Story" });
    act(() => shareButton.focus());
    act(() => sourceTrigger.focus());
    expect(within(firstScene).getByRole("dialog")).toBeInTheDocument();
    act(() => shareButton.focus());
    expect(within(firstScene).queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Related Questions" })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: story.plan.relatedQuestions[0] }),
    );
    expect(onRelatedQuestion).toHaveBeenCalledWith(story.plan.relatedQuestions[0]);

    fireEvent.click(screen.getByRole("button", { name: "Share this Story" }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent("Story shared");
  });

  it("exposes ready, active, and pending Rail targets on desktop and mobile", () => {
    const plan = makePlan();
    const scenes = makeScenes(plan);
    const props = {
      question: QUESTION,
      phase: "composing" as const,
      plan,
      scenes: scenes.slice(0, 2),
      evidence: [...EVIDENCE],
      story: null,
      error: null,
      onRetry: vi.fn(),
      onRelatedQuestion: vi.fn(),
    };
    const { rerender } = render(<StoryExperience {...props} />);

    const desktopRail = screen.getByRole("navigation", { name: "Story scenes" });
    expect(desktopRail.closest(".story-document")).toHaveAttribute(
      "data-story-rail-layout",
      "gutter",
    );
    const first = within(desktopRail).getByRole("button", { name: /Start with the operating truth/ });
    const second = within(desktopRail).getByRole("button", { name: /Trace decisions to evidence/ });
    const pending = within(desktopRail).getByRole("button", { name: /Build for the life after launch/ });

    expect(first).toHaveAttribute("data-state", "active");
    expect(first).toHaveAttribute("aria-current", "location");
    expect(second).toHaveAttribute("data-state", "ready");
    expect(second).toBeEnabled();
    expect(pending).toHaveAttribute("data-state", "pending");
    expect(pending).toBeDisabled();

    second.focus();
    fireEvent.click(second);
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-current", "location");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    const mobile = screen.getByRole("combobox", { name: "Choose a Story scene" });
    const options = within(mobile).getAllByRole("option");
    expect(options[0]).toBeEnabled();
    expect(options[1]).toBeEnabled();
    expect(options[2]).toBeDisabled();
    motionState.reducedMotion = true;
    rerender(<StoryExperience {...props} />);
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    fireEvent.change(mobile, { target: { value: "0" } });
    expect(mobile).toHaveValue("0");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });

  it("tracks the active Scene during normal scrolling without moving focus", () => {
    const story = makeStory();
    render(
      <>
        <div className="backdrop-root" data-testid="story-backdrop" />
        <StoryExperience
          question={QUESTION}
          phase="publishing"
          plan={story.plan}
          scenes={story.scenes}
          evidence={story.evidence}
          story={story}
          error={null}
          onRetry={vi.fn()}
          onRelatedQuestion={vi.fn()}
        />
      </>,
    );

    const desktopRail = screen.getByRole("navigation", { name: "Story scenes" });
    const secondTarget = within(desktopRail).getByRole("button", {
      name: /Trace decisions to evidence/,
    });
    const secondScene = document.querySelector<HTMLElement>('[data-story-scene-index="1"]');
    expect(secondScene).not.toBeNull();
    expect(intersectionCallback).not.toBeNull();
    expect(screen.getByTestId("story-backdrop")).toHaveAttribute(
      "data-story-cue",
      JSON.stringify(story.plan.scenes[0].cue),
    );

    act(() => {
      intersectionCallback?.(
        [
          {
            target: secondScene,
            isIntersecting: true,
            intersectionRatio: 0.82,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    });

    expect(secondTarget).toHaveAttribute("aria-current", "location");
    expect(screen.getByTestId("story-backdrop")).toHaveAttribute(
      "data-story-cue",
      JSON.stringify(story.plan.scenes[1].cue),
    );
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("appends a ready Scene without stealing focus or forcing scroll", () => {
    const plan = makePlan();
    const scenes = makeScenes(plan);
    const props = {
      question: QUESTION,
      phase: "composing" as const,
      plan,
      evidence: [...EVIDENCE],
      story: null,
      error: null,
      onRetry: vi.fn(),
      onRelatedQuestion: vi.fn(),
    };
    const { rerender } = render(
      <>
        <input aria-label="Reader note" />
        <StoryExperience {...props} scenes={scenes.slice(0, 1)} />
      </>,
    );
    const readerNote = screen.getByRole("textbox", { name: "Reader note" });
    readerNote.focus();
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    vi.mocked(window.scrollTo).mockClear();

    rerender(
      <>
        <input aria-label="Reader note" />
        <StoryExperience {...props} scenes={scenes.slice(0, 2)} />
      </>,
    );

    expect(readerNote).toHaveFocus();
    expect(screen.getByRole("heading", { name: scenes[1].title })).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
