import { ChapterHeading } from "noah-portfolio";

// ChapterHeading — the serif display anchor of a Scene, with an optional mono
// kicker. Text-heavy: exercises the nocturne serif display stack.

export const WithKicker = () => (
  <ChapterHeading props={{ kicker: "Chapter 01", text: "Noah, in brief" }} />
);

export const NoKicker = () => (
  <ChapterHeading props={{ text: "Where I've been" }} />
);

export const LongTitle = () => (
  <ChapterHeading
    props={{ kicker: "Chapter 04", text: "Things I've built, and what they taught me" }}
  />
);
