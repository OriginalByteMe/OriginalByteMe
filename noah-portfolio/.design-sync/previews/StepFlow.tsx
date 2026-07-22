import { StepFlow } from "noah-portfolio";

// StepFlow — numbered steps in matte surface rows, for explaining how something
// works.

export const HowItWorks = () => (
  <StepFlow
    props={{
      steps: [
        { title: "Ask a question", body: "A visitor types anything they want to know about Noah." },
        { title: "Ground in the corpus", body: "The model retrieves supporting facts from the markdown knowledge base." },
        { title: "Compose a spec", body: "It assembles a validated JSON tree of catalog components." },
        { title: "Render the story", body: "The renderer turns the spec into a scroll-driven answer." },
      ],
    }}
  />
);
