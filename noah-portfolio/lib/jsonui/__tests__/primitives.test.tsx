import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("Callout renders text and varies tone color", () => {
    const Callout = primitiveComponents.Callout;
    const { container: infoContainer } = render(
      <Callout props={{ text: "heads up" }} {...stubHandlers} />,
    );
    expect(screen.getByText("heads up")).toBeInTheDocument();
    expect(infoContainer.firstElementChild).toHaveClass("border-blue-500");

    const { container: successContainer } = render(
      <Callout props={{ text: "nice", tone: "success" }} {...stubHandlers} />,
    );
    expect(successContainer.firstElementChild).toHaveClass("border-green-500");

    const { container: warnContainer } = render(
      <Callout props={{ text: "careful", tone: "warn" }} {...stubHandlers} />,
    );
    expect(warnContainer.firstElementChild).toHaveClass("border-amber-500");
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
});
