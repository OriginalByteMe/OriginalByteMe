import { Columns, Callout } from "noah-portfolio";

// Columns — a responsive multi-column grid (1–3). Children flow into the
// columns and collapse to a single column on small screens.

export const TwoColumns = () => (
  <Columns props={{ count: 2 }}>
    <Callout props={{ text: "Backend: Ruby on Rails, Node, Postgres.", tone: "info" }} />
    <Callout props={{ text: "Infra: Docker, Kubernetes, Terraform, AWS.", tone: "success" }} />
  </Columns>
);

export const ThreeColumns = () => (
  <Columns props={{ count: 3 }}>
    <Callout props={{ text: "Design", tone: "info" }} />
    <Callout props={{ text: "Build", tone: "success" }} />
    <Callout props={{ text: "Ship", tone: "warn" }} />
  </Columns>
);
