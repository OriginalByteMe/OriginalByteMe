import { StatCallout } from "noah-portfolio";

// StatCallout — a big number + label in a matte pastel tile. Use for a single
// impactful metric inside a dense scene.

export const Years = () => <StatCallout props={{ value: "6", label: "years shipping software" }} />;
export const Projects = () => <StatCallout props={{ value: "5", label: "featured projects" }} />;
export const Uptime = () => <StatCallout props={{ value: "99.9%", label: "home-lab uptime" }} />;
