import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StateProvider, createStateStore } from "@json-render/react";
import { primitiveComponents } from "@/lib/jsonui/components/primitives";

/** Stub the event-handling members of BaseComponentProps that these presentational components ignore. */
const stubHandlers = {
  emit: () => {},
  on: () => ({ emit: () => {}, shouldPreventDefault: false, bound: false }),
};

describe("primitiveComponents", () => {
  it("Prose renders its text", () => {
    const Prose = primitiveComponents.Prose;
    render(<Prose props={{ text: "hello world" }} children={null} {...stubHandlers} />);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("Section renders title and children", () => {
    const Section = primitiveComponents.Section;
    render(
      <Section props={{ title: "About Me" }} {...stubHandlers}>
        <p>child content</p>
      </Section>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "About Me" })).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("Section omits the heading when title is absent", () => {
    const Section = primitiveComponents.Section;
    render(
      <Section props={{}} {...stubHandlers}>
        <p>only child</p>
      </Section>,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("Stack applies the gap class", () => {
    const Stack = primitiveComponents.Stack;
    const { container } = render(
      <Stack props={{ gap: "lg" }} {...stubHandlers}>
        <span>item</span>
      </Stack>,
    );
    expect(container.firstElementChild).toHaveClass("space-y-12");
  });

  it("Stack defaults to md gap when unset", () => {
    const Stack = primitiveComponents.Stack;
    const { container } = render(
      <Stack props={{}} {...stubHandlers}>
        <span>item</span>
      </Stack>,
    );
    expect(container.firstElementChild).toHaveClass("space-y-6");
  });

  it("Columns renders a responsive grid-cols class capped at 3", () => {
    const Columns = primitiveComponents.Columns;
    const { container } = render(
      <Columns props={{ count: 3 }} {...stubHandlers}>
        <span>col</span>
      </Columns>,
    );
    expect(container.firstElementChild).toHaveClass("md:grid-cols-3");
  });

  it("Grid renders a responsive grid-cols class capped at 4", () => {
    const Grid = primitiveComponents.Grid;
    const { container } = render(
      <Grid props={{ cols: 4 }} {...stubHandlers}>
        <span>card</span>
      </Grid>,
    );
    expect(container.firstElementChild).toHaveClass("md:grid-cols-4", "grid-cols-1");
  });

  it("Heading renders the correct tag level", () => {
    const Heading = primitiveComponents.Heading;
    render(<Heading props={{ text: "Skills", level: 3 }} {...stubHandlers} />);
    const heading = screen.getByRole("heading", { level: 3, name: "Skills" });
    expect(heading.tagName).toBe("H3");
  });

  it("Callout renders text on a matte card and varies tone accent", () => {
    const Callout = primitiveComponents.Callout;
    const { container: infoContainer } = render(
      <Callout props={{ text: "heads up" }} {...stubHandlers} />,
    );
    expect(screen.getByText("heads up")).toBeInTheDocument();
    const infoEl = infoContainer.firstElementChild!;
    expect(infoEl).toHaveClass(
      "bg-[#fffdf8]",
      "dark:bg-[#2b2830]",
      "border-l-[#7a5fa0]",
    );

    const { container: successContainer } = render(
      <Callout props={{ text: "nice", tone: "success" }} {...stubHandlers} />,
    );
    expect(successContainer.firstElementChild).toHaveClass(
      "border-l-[#5646a8]",
      "dark:border-l-[#7fe0bd]",
    );

    const { container: warnContainer } = render(
      <Callout props={{ text: "careful", tone: "warn" }} {...stubHandlers} />,
    );
    expect(warnContainer.firstElementChild).toHaveClass(
      "border-l-[#5646a8]",
      "dark:border-l-[#9d8ff2]",
    );
  });

  it("Quote renders text and optional citation", () => {
    const Quote = primitiveComponents.Quote;
    render(<Quote props={{ text: "Ship it.", cite: "Noah" }} {...stubHandlers} />);
    expect(screen.getByText("Ship it.")).toBeInTheDocument();
    expect(screen.getByText("— Noah")).toBeInTheDocument();
  });

  it("Quote omits the footer when cite is absent", () => {
    const Quote = primitiveComponents.Quote;
    render(<Quote props={{ text: "No attribution" }} {...stubHandlers} />);
    expect(screen.getByText("No attribution")).toBeInTheDocument();
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument();
  });

  it("Section uses min-h-screen for height 'screen' and py-20 for 'auto'", () => {
    const Section = primitiveComponents.Section;
    const screenEl = render(
      <Section props={{ height: "screen" }} {...stubHandlers}>
        <p>c</p>
      </Section>,
    ).container.querySelector("section")!;
    expect(screenEl.className).toContain("min-h-screen");
    expect(screenEl.className).not.toContain("py-20");
    const autoEl = render(
      <Section props={{ height: "auto" }} {...stubHandlers}>
        <p>c</p>
      </Section>,
    ).container.querySelector("section")!;
    expect(autoEl.className).toContain("py-20");
    expect(autoEl.className).not.toContain("min-h-screen");
  });

  it("Section applies centering flex classes only when centered is true", () => {
    const Section = primitiveComponents.Section;
    const centeredEl = render(
      <Section props={{ centered: true }} {...stubHandlers}>
        <p>c</p>
      </Section>,
    ).container.querySelector("section")!;
    expect(centeredEl).toHaveClass("flex", "flex-col", "items-center", "justify-center");
    const plainEl = render(
      <Section props={{ centered: false }} {...stubHandlers}>
        <p>c</p>
      </Section>,
    ).container.querySelector("section")!;
    expect(plainEl.className).not.toContain("items-center");
  });

  it("Section title margin follows the titleMb variant", () => {
    const Section = primitiveComponents.Section;
    const lgH2 = render(
      <Section props={{ title: "T", titleMb: "lg" }} {...stubHandlers} />,
    ).container.querySelector("h2")!;
    expect(lgH2.className).toContain("mb-12");
    const smH2 = render(
      <Section props={{ title: "T", titleMb: "sm" }} {...stubHandlers} />,
    ).container.querySelector("h2")!;
    expect(smH2.className).toContain("mb-4");
  });

  it("Prose renders the state value bound at statePath, not the fallback text", () => {
    const Prose = primitiveComponents.Prose;
    const store = createStateStore({ story: { blurb: "From state" } });
    render(
      <StateProvider store={store}>
        <Prose props={{ text: "fallback", statePath: "/story/blurb" }} {...stubHandlers} />
      </StateProvider>,
    );
    expect(screen.getByText("From state")).toBeInTheDocument();
    expect(screen.queryByText("fallback")).not.toBeInTheDocument();
  });

  it("Prose falls back to props.text when the bound state value is missing under StateProvider", () => {
    const Prose = primitiveComponents.Prose;
    const store = createStateStore({ story: {} });
    render(
      <StateProvider store={store}>
        <Prose props={{ text: "fallback", statePath: "/story/missing" }} {...stubHandlers} />
      </StateProvider>,
    );
    expect(screen.getByText("fallback")).toBeInTheDocument();
  });

  it("renders entrance primitives as visible semantic elements without motion residue", () => {
    const Prose = primitiveComponents.Prose;
    const Section = primitiveComponents.Section;
    const Stack = primitiveComponents.Stack;
    const Callout = primitiveComponents.Callout;
    const { container } = render(
      <>
        <Prose props={{ text: "prose" }} {...stubHandlers} />
        <Section props={{}} {...stubHandlers}>
          section
        </Section>
        <Stack props={{}} {...stubHandlers}>
          stack
        </Stack>
        <Callout props={{ text: "callout" }} {...stubHandlers} />
      </>,
    );
    const roots = [
      container.querySelector("p"),
      container.querySelector("section"),
      container.querySelector("div.space-y-6"),
      container.querySelector("div.bg-\\[\\#fffdf8\\]"),
    ];
    expect(roots.every(Boolean)).toBe(true);
    for (const element of roots) {
      expect(element).toBeVisible();
      expect(element).not.toHaveAttribute("style");
      expect(element).not.toHaveAttribute("data-framer-appear-id");
      expect(element).not.toHaveAttribute("data-framer-component");
    }
  });
});
