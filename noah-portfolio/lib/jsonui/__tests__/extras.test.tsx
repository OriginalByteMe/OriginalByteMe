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

  it("SpotifyNowPlaying renders without crashing", () => {
    const SpotifyNowPlaying = extraComponents.SpotifyNowPlaying;
    render(
      <Provider store={makeStore()}>
        <SpotifyNowPlaying props={{}} children={null} />
      </Provider>,
    );
    expect(screen.getByText(/Spotify Magic/)).toBeInTheDocument();
  });
});
