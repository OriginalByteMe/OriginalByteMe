import { useEffect } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MotionAsset } from "@/components/story/MotionAsset";
import {
  MOTION_ASSET_IDS,
  getMotionAsset,
  type MotionAssetId,
} from "@/lib/motion-assets/catalog";

const testState = vi.hoisted(() => ({
  reducedMotion: false,
  dotLottieProps: null as Record<string, unknown> | null,
  dotLottiePlayer: null as Record<string, unknown> | null,
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useReducedMotion: () => testState.reducedMotion,
  };
});

vi.mock("@lottiefiles/dotlottie-react", () => ({
  DotLottieReact: function MockDotLottieReact(
    props: Record<string, unknown>,
  ) {
    testState.dotLottieProps = props;
    const refCallback = props.dotLottieRefCallback;
    const player = testState.dotLottiePlayer;
    useEffect(() => {
      if (typeof refCallback !== "function" || !player) return;
      refCallback(player);
      return () => refCallback(null);
    }, [player, refCallback]);
    return <canvas data-testid="dotlottie-canvas" />;
  },
}));

type ObserverCallback = IntersectionObserverCallback;

let observerCallback: ObserverCallback | null = null;
let observedTarget: Element | null = null;

class TestIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0.15];

  constructor(callback: ObserverCallback) {
    observerCallback = callback;
  }

  observe(target: Element) {
    observedTarget = target;
  }

  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function setIntersecting(isIntersecting: boolean) {
  if (!observedTarget || !observerCallback) {
    throw new Error("Motion Asset was not observed");
  }
  const bounds = observedTarget.getBoundingClientRect();
  observerCallback(
    [
      {
        target: observedTarget,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: bounds,
        intersectionRect: bounds,
        rootBounds: null,
        time: 0,
      },
    ],
    {} as IntersectionObserver,
  );
}

describe("MotionAsset", () => {
  beforeEach(() => {
    testState.reducedMotion = false;
    testState.dotLottieProps = null;
    testState.dotLottiePlayer = null;
    observerCallback = null;
    observedTarget = null;
    vi.stubGlobal("IntersectionObserver", TestIntersectionObserver);
  });

  it("renders nothing for unknown or retired IDs", () => {
    const { container, rerender } = render(
      <MotionAsset assetId={"StaticComposition" as MotionAssetId} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<MotionAsset assetId={"signal-lantern" as MotionAssetId} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders meaningful dotLottie assets with stable semantics, overrides, and bounds", async () => {
    render(
      <MotionAsset
        assetId="printer-forge"
        label="Noah turns a digital model into a physical print"
      />,
    );

    const asset = screen.getByRole("img", {
      name: "Noah turns a digital model into a physical print",
    });
    expect(asset).toHaveAttribute("data-motion-asset", "printer-forge");
    expect(asset).toHaveAttribute("data-motion-renderer", "dotlottie");
    expect(asset).toHaveAttribute("data-motion-state", "paused");
    expect(asset).toHaveStyle({
      aspectRatio: String(260 / 332),
      maxWidth: "360px",
      minWidth: "min(100%, 180px)",
    });
    await waitFor(() => expect(testState.dotLottieProps).not.toBeNull());
  });

  it("hides decorative spark-loader from assistive technology", () => {
    const { container } = render(
      <MotionAsset assetId="spark-loader" label="Ignored label" />,
    );
    const asset = container.querySelector('[data-motion-asset="spark-loader"]');

    expect(asset).toHaveAttribute("aria-hidden", "true");
    expect(asset).not.toHaveAttribute("role");
    expect(asset).not.toHaveAttribute("aria-label");
  });

  it("ships a curated static poster for every asset under reduced motion", () => {
    testState.reducedMotion = true;

    for (const assetId of MOTION_ASSET_IDS) {
      const catalogAsset = getMotionAsset(assetId);
      const { container, unmount } = render(<MotionAsset assetId={assetId} />);
      const asset = container.querySelector(
        `[data-motion-asset="${assetId}"]`,
      );
      const poster = asset?.querySelector("svg");

      expect(asset).toHaveAttribute("data-motion-state", "static");
      expect(poster).toHaveAttribute(
        "viewBox",
        catalogAsset?.intrinsic.viewBox,
      );
      expect(poster).toHaveAttribute("data-motion-poster-state", "static");
      unmount();
    }

    expect(screen.queryByTestId("dotlottie-canvas")).not.toBeInTheDocument();
    expect(testState.dotLottieProps).toBeNull();
  });

  it("uses the catalog label for meaningful reduced-motion artwork", () => {
    testState.reducedMotion = true;
    render(<MotionAsset assetId="circuit-mind" />);

    expect(
      screen.getByRole("img", {
        name: "Circuit paths animate through an isometric robot brain",
      }),
    ).toHaveAttribute("data-motion-state", "static");
  });

  it("loads a representative dotLottie only from its local package and pauses it offscreen", async () => {
    const play = vi.fn();
    const pause = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    testState.dotLottiePlayer = {
      play,
      pause,
      addEventListener,
      removeEventListener,
    };
    render(<MotionAsset assetId="data-center" />);
    await waitFor(() => expect(testState.dotLottieProps).not.toBeNull());
    expect(testState.dotLottieProps).toMatchObject({
      src: "/motion/data-center.lottie",
      animationId: "data-center",
      autoplay: false,
      loop: true,
    });
    expect(String(testState.dotLottieProps?.src)).not.toMatch(/^https?:|^\/\//);

    const asset = screen.getByRole("img", {
      name: "Rows of data center racks pulse with network activity",
    });
    await waitFor(() => expect(pause).toHaveBeenCalled());
    expect(play).not.toHaveBeenCalled();

    play.mockClear();
    pause.mockClear();
    act(() => setIntersecting(true));
    expect(asset).toHaveAttribute("data-motion-state", "playing");
    await waitFor(() => expect(play).toHaveBeenCalled());

    play.mockClear();
    pause.mockClear();
    act(() => setIntersecting(false));
    expect(asset).toHaveAttribute("data-motion-state", "paused");
    await waitFor(() => expect(pause).toHaveBeenCalled());
  });

  it("falls back to the curated static poster when the dotLottie runtime fails", async () => {
    let loadError: (() => void) | undefined;
    const player = {
      play: vi.fn(),
      pause: vi.fn(),
      addEventListener: vi.fn((event: string, callback: () => void) => {
        if (event === "loadError") loadError = callback;
      }),
      removeEventListener: vi.fn(),
    };

    testState.dotLottiePlayer = player;
    render(<MotionAsset assetId="morning-coffee" />);
    await waitFor(() => expect(testState.dotLottieProps).not.toBeNull());
    expect(loadError).toBeTypeOf("function");
    act(() => loadError?.());

    const asset = screen.getByRole("img", {
      name: "A steaming cup completes a morning coffee ritual",
    });
    expect(asset).toHaveAttribute("data-motion-state", "static");
    expect(asset).toHaveAttribute("data-motion-runtime-fallback", "true");
    expect(screen.queryByTestId("dotlottie-canvas")).not.toBeInTheDocument();
    expect(asset.querySelector("svg")).toHaveAttribute("viewBox", "0 0 500 500");
  });
});
