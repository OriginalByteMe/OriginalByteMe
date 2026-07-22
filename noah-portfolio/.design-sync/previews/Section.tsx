import { Section, Heading, Prose } from "noah-portfolio";

// Section — a full-width vertical band with an optional serif heading. `height`
// "screen" makes it full-viewport; `centered` centers content; `titleMb` tunes
// the heading gap.

export const WithTitle = () => (
  <Section props={{ title: "What I care about" }}>
    <Prose
      props={{
        text: "I like pragmatic systems, tight feedback loops, and interfaces that feel considered. The Ask-Me portfolio is my playground for all three.",
      }}
    />
  </Section>
);

export const Centered = () => (
  <Section props={{ title: "Say hi", centered: true }}>
    <Prose props={{ text: "My inbox is open and I actually reply." }} />
  </Section>
);

export const NoTitle = () => (
  <Section props={{}}>
    <Heading props={{ text: "A section without its own heading", level: 3 }} />
    <Prose props={{ text: "Sections can carry any children — headings, prose, cards, or whole scenes." }} />
  </Section>
);
