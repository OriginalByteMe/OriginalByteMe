import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type SiteTakeoverComponent from "@/components/site/SiteTakeover";
import { installFakeAudio, stubDialog, type HeardAudio } from "@/lib/site/__fixtures__/browser-fakes";
import { CURRENT_PUBLIC_STORY, CURRENT_QUESTION } from "@/lib/story/__fixtures__/story-fixtures";

type Props = ComponentProps<typeof SiteTakeoverComponent>;

let SiteTakeover: typeof SiteTakeoverComponent;
let unlockSiteSound: () => void;
let audio: HeardAudio;

const { site, evidence } = CURRENT_PUBLIC_STORY;
// The fixture site has nav, hero, two sections, related questions and a footer.
const BLOCKS = 6;
const blockStates = () =>
  Array.from(document.querySelectorAll("[data-block]"), (block) => block.getAttribute("data-block"));
const shown = (count: number) =>
  Array.from({ length: BLOCKS }, (_, index) => (index < count ? "shown" : "pending"));

function renderTakeover(initial: Partial<Props> = {}) {
  let props: Props = {
    mode: "streaming",
    question: CURRENT_QUESTION,
    site: null,
    evidence: [],
    story: null,
    error: null,
    onAsk: vi.fn(),
    onRetry: vi.fn(),
    onBack: vi.fn(),
    ...initial,
  };
  const view = render(<SiteTakeover {...props} />);
  return {
    ...props,
    rerender(next: Partial<Props>) {
      props = { ...props, ...next };
      view.rerender(<SiteTakeover {...props} />);
    },
  };
}

beforeAll(stubDialog);

beforeEach(async () => {
  // Dynamic imports after resetModules give every test a fresh audio singleton; static imports
  // would share one AudioContext across tests, so "never unlocked" could not be observed.
  vi.resetModules();
  ({ default: SiteTakeover } = await import("@/components/site/SiteTakeover"));
  ({ unlockSiteSound } = await import("@/lib/site/sound"));
  audio = installFakeAudio();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SiteTakeover", () => {
  it("shows the question while generating and ticks", () => {
    unlockSiteSound();
    renderTakeover();

    expect(screen.getByRole("status", { name: "Building your site" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: CURRENT_QUESTION })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1000));
    expect(audio.sounds).toBeGreaterThan(0);
  });

  it("builds a site that arrives while streaming one block at a time, snapping each into place", () => {
    unlockSiteSound();
    const takeover = renderTakeover();
    takeover.rerender({ site, evidence });

    expect(blockStates()).toEqual(shown(0));
    for (let count = 1; count <= BLOCKS; count += 1) {
      const before = audio.sounds;
      act(() => vi.advanceTimersByTime(count === 1 ? 320 : 430));
      expect(blockStates()).toEqual(shown(count));
      expect(audio.sounds).toBeGreaterThan(before);
    }
    expect(document.querySelector(".gs")).toHaveAttribute("data-building");
    act(() => vi.advanceTimersByTime(700));
    expect(document.querySelector(".gs")).not.toHaveAttribute("data-building");
  });

  it.each([
    ["a share link, where sound was never unlocked", false],
    ["a history restore after an earlier ask", true],
  ])("renders a site present from mount fully built and silent: %s", (_case, unlocked) => {
    if (unlocked) unlockSiteSound();
    renderTakeover({ mode: "answer", site, evidence, story: CURRENT_PUBLIC_STORY });

    expect(screen.getByRole("heading", { level: 1, name: site.hero.headline })).toBeInTheDocument();
    expect(blockStates()).toEqual(shown(BLOCKS));
    expect(document.querySelector(".gs")).not.toHaveAttribute("data-building");
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(audio.sounds).toBe(0);
    expect(audio.contexts).toBe(unlocked ? 1 : 0);
  });

  it("keeps building when the stored copy of the same site is published mid-build", () => {
    unlockSiteSound();
    const takeover = renderTakeover();
    takeover.rerender({ site, evidence });
    act(() => vi.advanceTimersByTime(320 + 430));
    expect(blockStates()).toEqual(shown(2));

    const published = structuredClone(CURRENT_PUBLIC_STORY);
    takeover.rerender({ mode: "answer", story: published, site: published.site });
    expect(blockStates()).toEqual(shown(2));
    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();

    const before = audio.sounds;
    act(() => vi.advanceTimersByTime(430));
    expect(blockStates()).toEqual(shown(3));
    expect(audio.sounds).toBeGreaterThan(before);
    act(() => vi.advanceTimersByTime(3 * 430 + 700));
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument();
  });

  it("stops a build that fails part way, says so, and retries on Try again", () => {
    unlockSiteSound();
    const takeover = renderTakeover();
    takeover.rerender({ site, evidence });
    act(() => vi.advanceTimersByTime(320));

    takeover.rerender({ mode: "error", error: "Publishing is paused" });
    expect(screen.getByRole("alert")).toHaveTextContent("Publishing is paused");
    expect(within(screen.getByRole("toolbar", { name: "Site controls" })).getByText("Stopped")).toBeInTheDocument();
    const before = audio.sounds;
    act(() => vi.advanceTimersByTime(10_000));
    expect(audio.sounds).toBe(before);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(takeover.onRetry).toHaveBeenCalledOnce();
  });

  it("goes back to the portfolio from the Back button and from Escape", () => {
    const takeover = renderTakeover({ mode: "answer", site, evidence, story: CURRENT_PUBLIC_STORY });

    fireEvent.click(screen.getByRole("button", { name: "Back to portfolio" }));
    // Escape on a modal dialog fires `cancel`.
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(takeover.onBack).toHaveBeenCalledTimes(2);
  });

  it("remembers a muted toggle and builds silently while muted", () => {
    unlockSiteSound();
    const takeover = renderTakeover();
    fireEvent.click(screen.getByRole("button", { name: "Turn sound off" }));
    expect(window.localStorage.getItem("siteSoundMuted")).toBe("1");

    takeover.rerender({ site, evidence });
    act(() => vi.advanceTimersByTime(10_000));
    expect(blockStates()).toEqual(shown(BLOCKS));
    expect(audio.sounds).toBe(0);

    cleanup();
    renderTakeover();
    expect(screen.getByRole("button", { name: "Turn sound on" })).toBeInTheDocument();
  });

  it("asks the related question whose button was pressed", () => {
    const takeover = renderTakeover({ mode: "answer", site, evidence, story: CURRENT_PUBLIC_STORY });
    const question = site.relatedQuestions[1];

    const related = screen.getByRole("region", { name: "Keep exploring" });
    fireEvent.click(within(related).getByRole("button", { name: question }));
    expect(takeover.onAsk).toHaveBeenCalledWith(question);
  });
});
