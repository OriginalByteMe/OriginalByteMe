import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Renderer, StateProvider, ActionProvider, VisibilityProvider, createStateStore } from "@json-render/react";
import { registry } from "@/lib/jsonui/registry";
import { homeSpec } from "@/lib/jsonui/homeSpec";

// End-to-end proof that the fallback home spec assembles through the real
// registry: every section/subsection component resolves and renders, and the
// bio Prose binds from corpus state rather than falling back to its literal.
function renderHome() {
  const store = createStateStore({
    corpus: {
      bio: { summary: "State-bound bio paragraph." },
      skills: [
        {
          category: "Programming Languages",
          skills: [{ name: "TypeScript", lightImage: "/ts-light.svg", darkImage: "/ts-dark.svg" }],
        },
      ],
      careerTimeline: [
        { company: "Supa", role: "Full-Stack Developer", period: "2020 - Present", logo: "/supa.png", url: "https://supa.so" },
      ],
      operatingSystems: [
        {
          name: "Linux",
          systems: [
            { name: "Ubuntu", lightImage: "/ubuntu-light.svg", darkImage: "/ubuntu-dark.svg" },
            { name: "Fedora", lightImage: "/fedora-light.svg", darkImage: "/fedora-dark.svg" },
          ],
        },
      ],
      projects: [
        {
          slug: "cutout",
          title: "AI Image Cutout Tool",
          description: "d",
          image: "/cutout.png",
          url: "https://example.com",
          technologies: [{ name: "React", lightIcon: "/react-light.svg", darkIcon: "/react-dark.svg" }],
        },
      ],
      contact: { email: "noah@example.com", github: "https://github.com/OriginalByteMe", linkedin: "https://linkedin.com/in/noah" },
    },
  });
  return render(
    <StateProvider store={store}>
      <ActionProvider>
        <VisibilityProvider>
          <Renderer spec={homeSpec} registry={registry} />
        </VisibilityProvider>
      </ActionProvider>
    </StateProvider>,
  );
}

describe("homeSpec end-to-end render", () => {
  it("assembles every home section and subsection heading through the registry", () => {
    renderHome();
    for (const name of [
      "About Me",
      "Skills",
      "Work History",
      "Operating Systems",
      "Side Projects",
      "Projects",
      "Contact Me",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("binds the bio summary from state rather than the hard-coded fallback", () => {
    renderHome();
    expect(screen.getByText("State-bound bio paragraph.")).toBeInTheDocument();
    expect(screen.queryByText(/keen eye for design/)).not.toBeInTheDocument();
  });
});
