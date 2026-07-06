import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DesignContractStoryboard } from "@/lib/jsonui/components/_prototype";

describe("DesignContractStoryboard", () => {
  it("renders both the answer and home-section demos", () => {
    render(<DesignContractStoryboard />);

    expect(screen.getByRole("heading", { name: "Design Contract Storyboard (#26)" })).toBeInTheDocument();
    expect(screen.getByText("Answer layout")).toBeInTheDocument();
    expect(screen.getByText("Home-section layout")).toBeInTheDocument();
    expect(screen.getByText("What is your tech stack?")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "About Me" })).toBeInTheDocument();
  });
});
