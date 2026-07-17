import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChatBox from "@/components/ChatBox";

const askMeState = vi.hoisted(() => ({
  ask: vi.fn(),
  goHome: vi.fn(),
  mode: "home" as "home" | "streaming" | "answer",
  question: "",
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
});

afterEach(cleanup);

describe("ChatBox editorial prompt surface", () => {
  it("preserves the textbox, submit, suggestion, and decorative semantics", () => {
    render(<ChatBox variant="editorial" />);

    const input = screen.getByRole("textbox", { name: "Ask a question about Noah" });
    const submit = screen.getByRole("button", { name: "Send question" });

    expect(input).toHaveAttribute("maxLength", "280");
    expect(input).toHaveAttribute("placeholder", "Ask me anything about Noah…");
    expect(submit).toBeDisabled();
    expect(submit.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Prompt routes")).toBeVisible();
    expect(screen.getByRole("button", { name: "What does Noah do for a living?" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "How does the AI cutout tool work?" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "What is Noah good at?" })).toBeEnabled();

    const routeNumber = document.querySelector(".ask-composer__route span");
    expect(routeNumber).toHaveAttribute("aria-hidden", "true");
  });

  it("submits a trimmed keyboard question once, clears the field, and notifies its host", async () => {
    const onSubmitted = vi.fn();
    render(<ChatBox variant="editorial" onSubmitted={onSubmitted} />);

    const input = screen.getByRole("textbox", { name: "Ask a question about Noah" });
    fireEvent.change(input, { target: { value: "  What has Noah built?  " } });
    expect(screen.getByRole("button", { name: "Send question" })).toBeEnabled();

    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(askMeState.ask).toHaveBeenCalledWith("What has Noah built?"));
    expect(askMeState.ask).toHaveBeenCalledTimes(1);
    expect(onSubmitted).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("");
  });

  it("dispatches suggestion actions without changing their labels", () => {
    const onSubmitted = vi.fn();
    render(<ChatBox variant="editorial" onSubmitted={onSubmitted} />);

    fireEvent.click(screen.getByRole("button", { name: "What is Noah good at?" }));

    expect(askMeState.ask).toHaveBeenCalledWith("What is Noah good at?");
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it("dispatches a newer question while exposing streaming busy state", async () => {
    askMeState.mode = "streaming";
    const { container } = render(<ChatBox variant="editorial" />);

    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "true");
    const input = screen.getByRole("textbox", { name: "Ask a question about Noah" });
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: "What should replace this Story?" } });
    const submit = screen.getByRole("button", { name: "Send question" });
    expect(submit).toBeEnabled();
    expect(submit.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(submit);
    await waitFor(() =>
      expect(askMeState.ask).toHaveBeenCalledWith("What should replace this Story?"),
    );
  });

  it("preserves the editorial Home action accessible name", () => {
    askMeState.mode = "answer";
    askMeState.question = "A previous question";
    render(<ChatBox variant="editorial" />);

    fireEvent.click(screen.getByRole("button", { name: "↺ Home" }));
    expect(askMeState.goHome).toHaveBeenCalledTimes(1);
  });

  it("preserves the default dock presentation and Home action", () => {
    askMeState.mode = "answer";
    askMeState.question = "A previous question";
    const { container } = render(<ChatBox />);

    expect(container.querySelector(".ask-composer")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Ask a question about Noah" })).toHaveClass("rounded-full");
    fireEvent.click(screen.getByRole("button", { name: "↺ Home" }));
    expect(askMeState.goHome).toHaveBeenCalledTimes(1);
  });
});
