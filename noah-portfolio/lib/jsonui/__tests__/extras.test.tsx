import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it, vi } from "vitest";
import { extraComponents } from "@/lib/jsonui/components/extras";
import { makeStore } from "@/lib/store";

const stubHandlers = {
  emit: vi.fn(),
  on: vi.fn(),
};
vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: () => null,
}));

describe("extraComponents", () => {
  it("StepFlow renders each step title", () => {
    const StepFlow = extraComponents.StepFlow;
    render(
      <StepFlow
        {...stubHandlers}
        props={{
          steps: [
            { title: "Upload", body: "b" },
            { title: "Segment", body: "b" },
          ],
        }}
        children={null}
      />,
    );
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Segment")).toBeInTheDocument();
  });

  it("ImageBlock renders alt text and caption", () => {
    const ImageBlock = extraComponents.ImageBlock;
    render(
      <ImageBlock
        {...stubHandlers}
        props={{ src: "/pic.png", alt: "A portrait of Noah", caption: "Noah, 2024" }}
        children={null}
      />,
    );
    expect(screen.getByAltText("A portrait of Noah")).toBeInTheDocument();
    expect(screen.getByText("Noah, 2024")).toBeInTheDocument();
  });

  it("LottieFigure renders its caption", () => {
    const LottieFigure = extraComponents.LottieFigure;
    render(
      <LottieFigure
        {...stubHandlers}
        props={{ src: "https://lottie.host/example.lottie", caption: "A little wave" }}
        children={null}
      />,
    );
    expect(screen.getByText("A little wave")).toBeInTheDocument();
  });

  it("SpotifyNowPlaying renders the closed-state CTA button", () => {
    const SpotifyNowPlaying = extraComponents.SpotifyNowPlaying;
    render(
      <Provider store={makeStore()}>
        <SpotifyNowPlaying />
      </Provider>,
    );
    expect(screen.getByRole("button", { name: /click here to see some cool spotify magic/i })).toBeInTheDocument();
  });

  it("SideProjects renders both the 3D printing and blog cards", () => {
    const SideProjects = extraComponents.SideProjects;
    render(<SideProjects {...stubHandlers} props={{}} children={null} />);
    expect(screen.getByRole("heading", { level: 4, name: "3D Printing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "My blog!" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("SideProjects renders an optional title heading when a title is given", () => {
    const SideProjects = extraComponents.SideProjects;
    render(<SideProjects {...stubHandlers} props={{ title: "Side Projects" }} children={null} />);
    expect(screen.getByRole("heading", { level: 3, name: "Side Projects" })).toBeInTheDocument();
  });

  it("SideProjects links the blog card to Noah's blog", () => {
    const SideProjects = extraComponents.SideProjects;
    render(<SideProjects {...stubHandlers} props={{}} children={null} />);

    const blogLink = screen.getByRole("link", { name: /my blog/i });
    expect(blogLink).toHaveAttribute("href", "https://blog.noahrijkaard.com");
    expect(blogLink).toHaveAttribute("target", "_blank");
    expect(blogLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
