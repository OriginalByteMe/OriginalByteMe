import { Grid, StatCallout } from "noah-portfolio";

// Grid — a card grid (1–4 columns) for laying out cards of equal weight.

export const ThreeUp = () => (
  <Grid props={{ cols: 3 }}>
    <StatCallout props={{ value: "6", label: "years shipping" }} />
    <StatCallout props={{ value: "5", label: "featured projects" }} />
    <StatCallout props={{ value: "17", label: "tools in the box" }} />
  </Grid>
);

export const TwoUp = () => (
  <Grid props={{ cols: 2 }}>
    <StatCallout props={{ value: "∞", label: "compile errors dreamt away" }} />
    <StatCallout props={{ value: "1", label: "home k8s cluster" }} />
  </Grid>
);
