import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { describe, expect, it } from "vitest";
import { extraComponents } from "@/lib/jsonui/components/extras";
import { makeStore } from "@/lib/store";

describe("extraComponents", () => {
  it("StepFlow renders each step title", () => {
    const StepFlow = extraComponents.StepFlow;
    render(
      <StepFlow
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

  it("StepFlow badge uses the violet-emphasis accent on a matte surface, not bg-blue-500", () => {
    const StepFlow = extraComponents.StepFlow;
    render(
      <StepFlow props={{ steps: [{ title: "Upload", body: "b" }] }} children={null} />,
    );
    const badge = screen.getByText("1");
    expect(badge.className).toContain("text-[#5646a8]");
    expect(badge.className).toContain("dark:text-[#9d8ff2]");
    expect(badge.className).toContain("bg-[#fffdf8]");
    expect(badge.className).not.toContain("bg-blue-500");
  });

  it("ImageBlock renders alt text and caption", () => {
    const ImageBlock = extraComponents.ImageBlock;
    render(
      <ImageBlock
        props={{ src: "/pic.png", alt: "A portrait of Noah", caption: "Noah, 2024" }}
        children={null}
      />,
    );
    expect(screen.getByAltText("A portrait of Noah")).toBeInTheDocument();
    expect(screen.getByText("Noah, 2024")).toBeInTheDocument();
  });

  it("ImageBlock keeps the accessible image inside a matte figure with a mono caption", () => {
    const ImageBlock = extraComponents.ImageBlock;
    const { container } = render(
      <ImageBlock
        props={{ src: "/pic.png", alt: "A portrait of Noah", caption: "Noah, 2024" }}
        children={null}
      />,
    );
    const figure = screen.getByAltText("A portrait of Noah").closest("figure");
    expect(figure).not.toBeNull();
    expect(figure!.className).toContain("rounded-3xl");
    expect(figure!.className).toContain("bg-[#fffdf8]");
    expect(screen.getByText("Noah, 2024").className).toContain("font-mono");
    expect(screen.getByText("Noah, 2024").className).toContain("uppercase");
    expect(container.innerHTML).not.toContain("backdrop-blur");
  });

  it("LottieFigure renders its caption", () => {
    const LottieFigure = extraComponents.LottieFigure;
    render(
      <LottieFigure
        props={{ src: "https://lottie.host/example.lottie", caption: "A little wave" }}
        children={null}
      />,
    );
    expect(screen.getByText("A little wave")).toBeInTheDocument();
  });

  it("LottieFigure caption uses the mono label token, not the retired gray body", () => {
    const LottieFigure = extraComponents.LottieFigure;
    render(
      <LottieFigure
        props={{ src: "https://lottie.host/example.lottie", caption: "A little wave" }}
        children={null}
      />,
    );
    const caption = screen.getByText("A little wave");
    expect(caption.className).toContain("font-mono");
    expect(caption.className).toContain("text-[#6f6885]");
    expect(caption.className).not.toContain("text-gray-500");
  });

  it("SpotifyNowPlaying renders without crashing", () => {
    const SpotifyNowPlaying = extraComponents.SpotifyNowPlaying;
    render(
      <Provider store={makeStore()}>
        <SpotifyNowPlaying props={{}} children={null} />
      </Provider>,
    );
    expect(screen.getByText(/Spotify Magic/)).toBeInTheDocument();
  });

  it("SideProjects renders both the 3D printing and blog cards", () => {
    const SideProjects = extraComponents.SideProjects;
    render(<SideProjects props={{}} children={null} />);
    expect(screen.getByRole("heading", { level: 4, name: "3D Printing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "My blog!" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
  });

  it("SideProjects renders an optional title heading when a title is given", () => {
    const SideProjects = extraComponents.SideProjects;
    render(<SideProjects props={{ title: "Side Projects" }} children={null} />);
    expect(screen.getByRole("heading", { level: 3, name: "Side Projects" })).toBeInTheDocument();
  });

  it("SideProjects uses matte cards and links the blog card, with no frosted/blue leftovers", () => {
    const SideProjects = extraComponents.SideProjects;
    const { container } = render(<SideProjects props={{}} children={null} />);

    // Blog card is a real link that opens the blog in a new tab.
    const blogLink = screen.getByRole("link");
    expect(blogLink).toHaveAttribute("href", "https://blog.noahrijkaard.com");
    expect(blogLink).toHaveAttribute("target", "_blank");
    expect(blogLink.className).toContain("rounded-3xl");
    expect(blogLink.className).toContain("bg-[#fffdf8]");

    // 3D Printing card is a matte card.
    const printingCard = screen
      .getByRole("heading", { level: 4, name: "3D Printing" })
      .closest("div.rounded-3xl");
    expect(printingCard).not.toBeNull();
    expect(printingCard!.className).toContain("bg-[#fffdf8]");

    // No retired frosted-glass / bright-blue traces anywhere.
    expect(container.innerHTML).not.toContain("backdrop-blur");
    expect(container.innerHTML).not.toContain("blue-500");
    expect(container.innerHTML).not.toContain("blue-400");
  });
});
