import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AskBar from "@/components/AskBar";

const askMeState = vi.hoisted(() => ({
  ask: vi.fn(),
  goHome: vi.fn(),
  mode: "home" as "home" | "streaming" | "answer",
  question: "",
  askPromoted: false,
}));

vi.mock("@/components/AskMeProvider", () => ({
  useAskMe: () => askMeState,
}));

beforeEach(() => {
  askMeState.ask.mockReset();
  askMeState.ask.mockResolvedValue(undefined);
  askMeState.goHome.mockReset();
  askMeState.mode = "home";
  askMeState.question = "";
  askMeState.askPromoted = false;
});

afterEach(cleanup);

const textbox = () => screen.getByRole("textbox", { name: "Ask a question about Noah" });

describe("AskBar", () => {
  it.each(["home", "answer"] as const)("is already open in %s mode", (mode) => {
    askMeState.mode = mode;
    render(<AskBar />);

    const bar = screen.getByRole("region", { name: "Ask-Me" });
    expect(bar).toContainElement(textbox());
    expect(textbox()).toHaveAttribute("placeholder", "Ask me anything about Noah…");
  });

  it("sends a trimmed question through the ask flow when the form is submitted, then clears the field", async () => {
    render(<AskBar />);

    fireEvent.change(textbox(), { target: { value: "  What has Noah built?  " } });
    expect(screen.getByRole("button", { name: "Send question" })).toBeEnabled();
    fireEvent.submit(textbox().closest("form")!);

    await waitFor(() => expect(askMeState.ask).toHaveBeenCalledWith("What has Noah built?"));
    expect(askMeState.ask).toHaveBeenCalledTimes(1);
    expect(textbox()).toHaveValue("");
  });

  it("rejects an empty question and caps questions at 280 characters", () => {
    render(<AskBar />);

    expect(textbox()).toHaveAttribute("maxLength", "280");
    fireEvent.change(textbox(), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Send question" })).toBeDisabled();
    fireEvent.submit(textbox().closest("form")!);
    expect(askMeState.ask).not.toHaveBeenCalled();
  });

  it("offers the suggested questions in home mode and keeps focus in the bar once they go", () => {
    const { rerender } = render(<AskBar />);

    const suggestion = screen.getByRole("button", { name: "What is Noah good at?" });
    suggestion.focus();
    fireEvent.click(suggestion);
    expect(askMeState.ask).toHaveBeenCalledWith("What is Noah good at?");
    expect(screen.getByRole("button", { name: "What does Noah do for a living?" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "How does the AI cutout tool work?" })).toBeEnabled();

    askMeState.mode = "streaming";
    askMeState.question = "What is Noah good at?";
    rerender(<AskBar />);
    expect(suggestion).not.toBeInTheDocument();
    expect(textbox()).toHaveFocus();
  });

  it("accepts a newer question while a Story is still streaming", async () => {
    askMeState.mode = "streaming";
    const { container } = render(<AskBar />);

    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "true");
    fireEvent.change(textbox(), { target: { value: "What should replace this Story?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send question" }));
    await waitFor(() => expect(askMeState.ask).toHaveBeenCalledWith("What should replace this Story?"));
  });

  it("leads back home from an answer instead of offering suggestions", () => {
    askMeState.mode = "answer";
    askMeState.question = "A previous question";
    render(<AskBar />);

    expect(screen.queryByRole("button", { name: "What is Noah good at?" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "↺ Home" }));
    expect(askMeState.goHome).toHaveBeenCalledTimes(1);
  });

  it("points an arrow at the bar only while the Ask bar is promoted", () => {
    const { rerender } = render(<AskBar />);
    expect(screen.queryByTestId("ask-bar-arrow")).not.toBeInTheDocument();

    askMeState.askPromoted = true;
    rerender(<AskBar />);
    expect(screen.getByTestId("ask-bar-arrow")).toBeVisible();

    askMeState.askPromoted = false;
    rerender(<AskBar />);
    expect(screen.queryByTestId("ask-bar-arrow")).not.toBeInTheDocument();
  });
});
