import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
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

function takeoverProps(initial: Partial<Props> = {}): Props {
  return {
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
}

function renderTakeover(initial: Partial<Props> = {}) {
  let props = takeoverProps(initial);
  const view = render(<SiteTakeover {...props} />);
  return {
    ...props,
    unmount: view.unmount,
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
  vi.restoreAllMocks();
  vi.doUnmock("framer-motion");
});

describe("SiteTakeover", () => {
  it("shows the question while generating and makes thinking noises", () => {
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

  it("shows the whole site at once under reduced motion, with one snap and no zoom", async () => {
    vi.doMock("framer-motion", async (importOriginal) => ({
      ...(await importOriginal<typeof import("framer-motion")>()),
      useReducedMotion: () => true,
    }));
    // Re-import so SiteTakeover picks up the mocked hook.
    vi.resetModules();
    ({ default: SiteTakeover } = await import("@/components/site/SiteTakeover"));
    ({ unlockSiteSound } = await import("@/lib/site/sound"));
    unlockSiteSound();
    const takeover = renderTakeover();

    const beforeSite = audio.sounds;
    takeover.rerender({ site, evidence });
    expect(blockStates()).toEqual(shown(BLOCKS));
    expect(document.querySelector(".gs")).not.toHaveAttribute("data-building");
    expect(document.querySelector(".site-stage")).not.toHaveAttribute("style");
    expect(audio.sounds).toBeGreaterThan(beforeSite);

    const afterSnap = audio.sounds;
    act(() => vi.advanceTimersByTime(10_000));
    expect(audio.sounds).toBe(afterSnap);
  });

  it("goes quiet when the visitor leaves part way through a build", () => {
    unlockSiteSound();
    const takeover = renderTakeover();
    takeover.rerender({ site, evidence });
    act(() => vi.advanceTimersByTime(320 + 430));
    expect(blockStates()).toEqual(shown(2));

    takeover.unmount();
    const before = audio.sounds;
    act(() => vi.advanceTimersByTime(10_000));
    expect(audio.sounds).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
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

  it.each([
    ["the Back button", () => fireEvent.click(screen.getByRole("button", { name: "Back to portfolio" }))],
    ["Escape", () => fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }))],
  ])("hands focus back to the control that opened the site, if it still exists, when leaving with %s", (_exit, leave) => {
    const opener = document.body.appendChild(document.createElement("button"));
    opener.focus();
    // Leaving unmounts the takeover, as the portfolio does when it returns home.
    function Portfolio() {
      const [open, setOpen] = useState(true);
      return open ? (
        <SiteTakeover {...takeoverProps({ mode: "answer", site, evidence, story: CURRENT_PUBLIC_STORY })} onBack={() => setOpen(false)} />
      ) : null;
    }
    render(<Portfolio />);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    leave();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("scrolls to sections in place instead of navigating, so browser Back still leaves the site", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    renderTakeover({ mode: "answer", site, evidence, story: CURRENT_PUBLIC_STORY });
    const jumps: Array<[HTMLElement, string]> = [
      [within(screen.getByRole("navigation")).getByRole("link", { name: site.sections[1].nav }), "gs-section-2"],
      [within(screen.getByRole("region", { name: site.hero.headline })).getByRole("link", { name: site.sections[0].nav }), "gs-section-1"],
      [screen.getByRole("link", { name: site.brand }), "gs-hero"],
    ];

    for (const [link, id] of jumps) {
      // A cancelled click is a fragment navigation that never happens, so no history entry is added.
      expect(fireEvent.click(link)).toBe(false);
      const target = document.getElementById(id);
      expect(scroll.mock.contexts.at(-1)).toBe(target);
      expect(document.activeElement).toBe(target);
    }
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
