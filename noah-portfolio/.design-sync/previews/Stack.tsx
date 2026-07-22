import { Stack, Callout, Prose } from "noah-portfolio";

// Stack — a vertical stack of children with a `gap` scale (sm / md / lg).

export const MediumGap = () => (
  <Stack props={{ gap: "md" }}>
    <Prose props={{ text: "Stacks compose the vertical rhythm of a spec." }} />
    <Callout props={{ text: "Each child keeps its own spacing; the stack only sets the gap between them.", tone: "info" }} />
    <Prose props={{ text: "Use lg between major beats, sm inside a dense group." }} />
  </Stack>
);

export const LargeGap = () => (
  <Stack props={{ gap: "lg" }}>
    <Prose props={{ text: "A larger gap gives each beat room to breathe." }} />
    <Prose props={{ text: "Good for separating narrative chapters." }} />
  </Stack>
);

export const SmallGap = () => (
  <Stack props={{ gap: "sm" }}>
    <Prose props={{ text: "A tight gap keeps related lines together." }} />
    <Prose props={{ text: "Good inside a single dense group." }} />
  </Stack>
);
