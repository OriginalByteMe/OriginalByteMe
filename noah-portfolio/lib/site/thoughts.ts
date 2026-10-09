// Thought bubbles for the generating screen. The browser only sees the finished site, so these are
// process phrases paced by elapsed time; none names a project, job, tool or picture that the answer
// might not contain.

const READING = [
  "Reading your question…",
  "Skimming Noah's notes…",
  "Opening the notebook…",
  "Finding the good bits…",
  "Thinking about this one…",
];
const MAKING = [
  "Trying a few layouts…",
  "Mixing some colours…",
  "Sketching some art…",
  "Writing a headline…",
  "Drafting the sections…",
  "Sorting out the order…",
  "Measuring the margins…",
];
const FINISHING = [
  "Checking the facts…",
  "Lining up the sources…",
  "Stacking the bricks…",
  "Tightening a few bolts…",
  "Oiling the gears…",
  "Beeping thoughtfully…",
  "Polishing the pixels…",
  "Still tinkering…",
];

/** A picker of bubble lines for the time since generation began, never one of the last three shown. */
export function thinker(random = Math.random): (elapsedMs: number) => string {
  const recent: string[] = [];
  return (elapsedMs) => {
    const stage = elapsedMs < 3000 ? READING : elapsedMs < 9000 ? MAKING : FINISHING;
    const fresh = stage.filter((line) => !recent.includes(line));
    const line = fresh[Math.floor(random() * fresh.length)];
    recent.push(line);
    if (recent.length > 3) recent.shift();
    return line;
  };
}
