import { OperatingSystemsGrid } from "noah-portfolio";

// OperatingSystemsGrid — matte cards of OS environments, each with a primary
// system badge and per-system pills. Bind statePath to "/corpus/operatingSystems".

export const WithTitle = () => (
  <OperatingSystemsGrid props={{ statePath: "/corpus/operatingSystems", title: "Operating systems" }} />
);

export const NoTitle = () => (
  <OperatingSystemsGrid props={{ statePath: "/corpus/operatingSystems" }} />
);
