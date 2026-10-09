import { describe, expect, it } from "vitest";

import { thinker } from "@/lib/site/thoughts";

describe("thinker", () => {
  it.each([
    [0, "Reading your question…"],
    [2999, "Reading your question…"],
    [3000, "Trying a few layouts…"],
    [8999, "Trying a few layouts…"],
    [9000, "Checking the facts…"],
  ])("opens with the stage for %ims into generation", (elapsedMs, line) => {
    expect(thinker(() => 0)(elapsedMs)).toBe(line);
  });

  it.each([
    [
      0,
      [
        "Reading your question…",
        "Skimming Noah's notes…",
        "Opening the notebook…",
        "Finding the good bits…",
        "Reading your question…",
      ],
    ],
    [
      0.9999,
      [
        "Thinking about this one…",
        "Finding the good bits…",
        "Opening the notebook…",
        "Skimming Noah's notes…",
        "Thinking about this one…",
      ],
    ],
  ])("never repeats one of the last three lines when chance keeps landing on %d", (chance, lines) => {
    const next = thinker(() => chance);
    expect([0, 600, 1200, 1800, 2400].map(next)).toEqual(lines);
  });
});
