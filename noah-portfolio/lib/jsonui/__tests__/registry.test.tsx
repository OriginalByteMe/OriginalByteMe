import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Renderer } from "@json-render/react";
import { registry } from "@/lib/jsonui/registry";
import { JsonUiProvider } from "@/components/JsonUiProvider";

describe("registry", () => {
  it("renders a bound CareerTimeline through the registry", () => {
    const spec = {
      root: "timeline",
      elements: {
        timeline: {
          type: "CareerTimeline",
          props: { statePath: "/corpus/careerTimeline" },
          children: [],
        },
      },
    };
    const initialState = {
      "/corpus/careerTimeline": [
        { company: "Supa", role: "Full-Stack Developer", period: "2020 - Present", logo: "", url: "#" },
      ],
    };
    render(
      <JsonUiProvider initialState={initialState}>
        <Renderer spec={spec as never} registry={registry} />
      </JsonUiProvider>,
    );
    expect(screen.getByText("Supa")).toBeInTheDocument();
  });

  it("renders nested primitives through the registry", () => {
    const spec = {
      root: "section",
      elements: {
        section: { type: "Section", props: { title: "About" }, children: ["prose"] },
        prose: { type: "Prose", props: { text: "hello from the registry" }, children: [] },
      },
    };
    render(
      <JsonUiProvider initialState={{}}>
        <Renderer spec={spec as never} registry={registry} />
      </JsonUiProvider>,
    );
    expect(screen.getByText("About")).toBeInTheDocument();
    expect(screen.getByText("hello from the registry")).toBeInTheDocument();
  });
});
