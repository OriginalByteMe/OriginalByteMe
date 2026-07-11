import { describe, it, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { storyComponents } from "@/lib/jsonui/components/story";

/**
 * framer-motion's `whileInView` (Scene) and `useInView` (StatReveal) both
 * mount an IntersectionObserver. jsdom doesn't ship one, so stub a no-op
 * observer; the tests assert static render output, not the view-gated
 * count-up.
 */
beforeAll(() => {
  class NoopIntersectionObserver implements IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds = [0];
  }

  Object.defineProperty(globalThis, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: NoopIntersectionObserver,
  });
});

/**
 * Stub the event-handling members of BaseComponentProps that these
 * presentational story components ignore. Mirrors primitives.test.tsx.
 */
const stubHandlers = {
  emit: () => {},
  on: () => ({ emit: () => {}, shouldPreventDefault: false, bound: false }),
};

describe("storyComponents", () => {
  it("ChapterHeading renders kicker and serif heading", () => {
    const ChapterHeading = storyComponents.ChapterHeading;
    render(
      <ChapterHeading
        props={{ text: "What does Noah do for work?", kicker: "Chapter 01" }}
        children={null}
        {...stubHandlers}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "What does Noah do for work?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Chapter 01")).toBeInTheDocument();
  });

  it("ChapterHeading omits the kicker when absent", () => {
    const ChapterHeading = storyComponents.ChapterHeading;
    render(
      <ChapterHeading props={{ text: "No kicker here" }} children={null} {...stubHandlers} />,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "No kicker here" }),
    ).toBeInTheDocument();
    // No mono kicker span rendered — the heading text is the only text node.
    expect(screen.queryByText("Chapter", { exact: false })).not.toBeInTheDocument();
  });

  it("NarrativeBeat renders its prose in a max-w-2xl measure", () => {
    const NarrativeBeat = storyComponents.NarrativeBeat;
    const { container } = render(
      <NarrativeBeat props={{ text: "a beat of narrative" }} children={null} {...stubHandlers} />,
    );
    expect(screen.getByText("a beat of narrative")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("max-w-2xl");
  });

  it("StatReveal renders caption and suffix (count-up is view-gated, not asserted)", () => {
    const StatReveal = storyComponents.StatReveal;
    const { container } = render(
      <StatReveal
        props={{ value: 6, suffix: "+", caption: "years shipping full-stack" }}
        children={null}
        {...stubHandlers}
      />,
    );
    // jsdom has no IntersectionObserver → inView stays false → the count
    // never advances, so we assert the static parts only.
    expect(screen.getByText("years shipping full-stack")).toBeInTheDocument();
    expect(screen.getByText("+")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("flex", "flex-col");
  });

  it("SequencedTimeline renders every row's period, role and company", () => {
    const SequencedTimeline = storyComponents.SequencedTimeline;
    const rows = [
      { period: "2020 - Present", role: "Full-Stack Developer", company: "Supa" },
      { period: "2023 - Present", role: "CAD Designer", company: "Bowiq" },
    ];
    render(
      <SequencedTimeline props={{ rows }} children={null} {...stubHandlers} />,
    );
    expect(screen.getByText("2020 - Present")).toBeInTheDocument();
    expect(screen.getByText("Full-Stack Developer")).toBeInTheDocument();
    expect(screen.getByText("Supa")).toBeInTheDocument();
    expect(screen.getByText("2023 - Present")).toBeInTheDocument();
    expect(screen.getByText("CAD Designer")).toBeInTheDocument();
    expect(screen.getByText("Bowiq")).toBeInTheDocument();
  });

  it("Scene is a full-height chapter that renders its children", () => {
    const Scene = storyComponents.Scene;
    const { container } = render(
      <Scene props={{ align: "center" }} {...stubHandlers}>
        <p>scene child</p>
      </Scene>,
    );
    const section = container.firstElementChild as HTMLElement;
    expect(section).toHaveClass(
      "relative",
      "flex",
      "min-h-screen",
      "items-center",
      "justify-center",
      "text-center",
    );
    expect(section).toContainElement(screen.getByText("scene child"));
  });
  it("Scene left-aligns start scenes", () => {
    const Scene = storyComponents.Scene;
    const { container } = render(
      <Scene props={{ align: "start" }} {...stubHandlers}>
        <p>start-aligned child</p>
      </Scene>,
    );
    const section = container.firstElementChild as HTMLElement;
    expect(section).toHaveClass("items-start", "justify-center", "text-left");
    expect(section).toContainElement(screen.getByText("start-aligned child"));
  });

  it("Scene renders an accent bar only when accent is set", () => {
    const Scene = storyComponents.Scene;
    const { container, rerender } = render(
      <Scene props={{ accent: "violet" }} {...stubHandlers}>
        <p>with accent</p>
      </Scene>,
    );
    const bar = container.querySelector(".h-1.w-16");
    expect(bar).not.toBeNull();
    expect(bar).toHaveClass("rounded-full");

    rerender(
      <Scene props={{ accent: "mint" }} {...stubHandlers}>
        <p>with mint accent</p>
      </Scene>,
    );
    expect(container.querySelector(".h-1.w-16")).toHaveClass(
      "bg-[#5646a8]",
      "dark:bg-[#7fe0bd]",
    );

    rerender(
      <Scene props={{}} {...stubHandlers}>
        <p>no accent</p>
      </Scene>,
    );
    expect(container.querySelector(".h-1.w-16")).toBeNull();
  });

  it("StaticComposition renders children in a centered reading column", () => {
    const StaticComposition = storyComponents.StaticComposition;
    const { container } = render(
      <StaticComposition props={{}} {...stubHandlers}>
        <p>static child</p>
      </StaticComposition>,
    );
    expect(screen.getByText("static child")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(
      "mx-auto",
      "w-full",
      "max-w-3xl",
      "items-center",
      "text-center",
    );
  });
});
