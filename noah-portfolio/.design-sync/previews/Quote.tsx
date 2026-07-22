import { Quote } from "noah-portfolio";

// Quote — a pull quote with an optional cite footer. Lifts a single memorable
// line in Noah's voice as a display moment.

export const WithCite = () => (
  <Quote
    props={{
      text: "I had a dream where I woke up one morning and had a whole day without any compilation errors.",
      cite: "Noah Rijkaard",
    }}
  />
);

export const NoCite = () => (
  <Quote props={{ text: "Ship the thing, then make it feel inevitable." }} />
);
