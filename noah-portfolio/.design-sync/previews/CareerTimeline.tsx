import { CareerTimeline } from "noah-portfolio";

// CareerTimeline — company/role history as a left-ruled list with logos and
// official links. Bind statePath to "/corpus/careerTimeline".

export const WithTitle = () => (
  <CareerTimeline props={{ statePath: "/corpus/careerTimeline", title: "Work history" }} />
);

export const NoTitle = () => (
  <CareerTimeline props={{ statePath: "/corpus/careerTimeline" }} />
);
