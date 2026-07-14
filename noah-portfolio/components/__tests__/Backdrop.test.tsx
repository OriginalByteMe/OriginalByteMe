import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Backdrop from "@/components/Backdrop";
import { ThemeProvider } from "@/components/ThemeProvider";
import { makeStore } from "@/lib/store";
import { setBackdropPreset } from "@/lib/store/slices/backdrop-slice";

vi.mock("@paper-design/shaders-react", () => ({
  GrainGradient: (props: { shape?: string }) => (
    <div data-testid="grain" data-shape={props.shape} />
  ),
  MeshGradient: () => <div data-testid="mesh" />,
  Metaballs: () => <div data-testid="metaballs" />,
  ColorPanels: () => <div data-testid="panels" />,
  Dithering: (props: {
    shape?: string;
    type?: string;
    size?: number;
    speed?: number;
    colorBack?: string;
    colorFront?: string;
    maxPixelCount?: number;
  }) => (
    <div
      data-testid="dither"
      data-shape={props.shape}
      data-type={props.type}
      data-size={props.size}
      data-speed={props.speed}
      data-colorback={props.colorBack}
      data-colorfront={props.colorFront}
      data-maxpixels={props.maxPixelCount}
    />
  ),
}));

vi.mock("@/lib/backdrop/webgl", () => ({ supportsWebGL2: vi.fn(() => true) }));
import { supportsWebGL2 } from "@/lib/backdrop/webgl";
const mockSupportsWebGL2 = vi.mocked(supportsWebGL2);

const localValues = new Map<string, string>();
const localStorageStub: Storage = {
  getItem: (key) => localValues.get(key) ?? null,
  setItem: (key, value) => localValues.set(key, String(value)),
  removeItem: (key) => localValues.delete(key),
  clear: () => localValues.clear(),
  key: (index) => [...localValues.keys()][index] ?? null,
  get length() {
    return localValues.size;
  },
};
Object.defineProperty(window, "localStorage", {
  value: localStorageStub,
  configurable: true,
  writable: true,
});

function stubMatchMedia({
  reducedMotion = false,
  coarsePointer = false,
}: { reducedMotion?: boolean; coarsePointer?: boolean } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion")
      ? reducedMotion
      : query.includes("pointer: coarse")
        ? coarsePointer
        : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function renderBackdrop(store = makeStore()) {
  const view = render(
    <Provider store={store}>
      <ThemeProvider>
        <Backdrop />
      </ThemeProvider>
    </Provider>,
  );
  return { store, ...view };
}

function shaderMarkers() {
  return screen.queryAllByTestId(/dither|grain|mesh|metaballs|panels/);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "dark");
  document.documentElement.className = "dark";
  stubMatchMedia();
  mockSupportsWebGL2.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Backdrop", () => {
  it("renders the restrained nocturne Dithering default with its pinned palette", () => {
    renderBackdrop();

    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toHaveAttribute("aria-hidden", "true");
    expect(backdrop).toHaveAttribute("data-preset", "ambientLava");
    expect(backdrop).toHaveAttribute("data-shape", "simplex");
    expect(backdrop.className).toContain("bg-gradient-to-b");

    const shader = screen.getByTestId("dither");
    expect(shader).toHaveAttribute("data-shape", "simplex");
    expect(shader).toHaveAttribute("data-type", "4x4");
    expect(shader).toHaveAttribute("data-size", "3.5");
    expect(shader).toHaveAttribute("data-speed", "0.18");
    expect(shader).toHaveAttribute("data-colorback", "#17151d");
    expect(shader).toHaveAttribute("data-colorfront", "#3d374b");
    expect(screen.queryByTestId("grain")).not.toBeInTheDocument();
  });

  it("keeps the CSS 2.5D scene decorative and exposes all motif layers", () => {
    renderBackdrop();

    const scene = screen.getByTestId("backdrop-scene");
    expect(scene).toHaveAttribute("aria-hidden", "true");
    expect(scene).toHaveAttribute("data-chapter", "hero");
    expect(scene).toHaveClass("backdrop-nocturne-scene");
    expect(scene.querySelectorAll(".backdrop-ark-layer")).toHaveLength(3);
    expect(scene.querySelectorAll(".backdrop-wave-contours span")).toHaveLength(5);
    expect(scene.querySelector(".backdrop-perspective-grid")).toBeInTheDocument();
    expect(scene.querySelector(".backdrop-perspective-rings")).toBeInTheDocument();
    expect(scene.querySelectorAll(".backdrop-fleck")).toHaveLength(7);
  });

  it("renders fallback and the static decorative scene without WebGL", () => {
    mockSupportsWebGL2.mockReturnValue(false);
    renderBackdrop();

    expect(shaderMarkers()).toHaveLength(0);
    expect(screen.getByTestId("backdrop")).toHaveAttribute("data-shader-active", "false");
    expect(screen.getByTestId("backdrop-scene")).toBeInTheDocument();
  });

  it("suppresses the continuously animated shader under reduced motion", () => {
    stubMatchMedia({ reducedMotion: true });
    renderBackdrop();

    expect(shaderMarkers()).toHaveLength(0);
    expect(screen.getByTestId("backdrop-scene")).toBeInTheDocument();
    expect(screen.getByTestId("backdrop").className).toContain("bg-gradient-to-b");
  });

  it("caps coarse-pointer rendering while retaining one shader", () => {
    stubMatchMedia({ coarsePointer: true });
    renderBackdrop();

    expect(shaderMarkers()).toHaveLength(1);
    expect(screen.getByTestId("dither")).toHaveAttribute("data-maxpixels", "1600000");
  });

  it("never overlaps shader canvases as preset families and shapes change", () => {
    const { store } = renderBackdrop();
    expect(shaderMarkers()).toHaveLength(1);

    act(() => store.dispatch(setBackdropPreset("ditherViolet")));
    expect(shaderMarkers()).toHaveLength(1);
    expect(screen.getByTestId("dither")).toHaveAttribute("data-shape", "wave");

    act(() => store.dispatch(setBackdropPreset("nightMatte")));
    expect(shaderMarkers()).toHaveLength(1);
    expect(screen.getByTestId("grain")).toHaveAttribute("data-shape", "sphere");

    act(() => store.dispatch(setBackdropPreset("metaOrbs")));
    expect(shaderMarkers()).toHaveLength(1);
    expect(screen.getByTestId("metaballs")).toBeInTheDocument();
  });

  it("passes the light nocturne palette to the one shader", async () => {
    localStorage.setItem("theme", "light");
    document.documentElement.className = "light";
    renderBackdrop();

    await waitFor(() => {
      expect(screen.getByTestId("dither")).toHaveAttribute("data-colorback", "#f4efe6");
      expect(screen.getByTestId("dither")).toHaveAttribute("data-colorfront", "#b9afc7");
    });
    expect(shaderMarkers()).toHaveLength(1);
  });
});
