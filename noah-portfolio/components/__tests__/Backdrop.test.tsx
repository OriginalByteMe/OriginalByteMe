import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";

import { makeStore } from "@/lib/store";
import { setBackdropPreset } from "@/lib/store/slices/backdrop-slice";
import { ThemeProvider } from "@/components/ThemeProvider";
import Backdrop from "@/components/Backdrop";

// The paper-design shader is a WebGL canvas; replace it with a marker div that
// surfaces the two props the contract cares about (shape + colorBack).
vi.mock("@paper-design/shaders-react", () => ({
  GrainGradient: (props: { shape?: string; colorBack?: string }) => (
    <div data-testid="grain" data-shape={props.shape} data-colorback={props.colorBack} />
  ),
}));

// WebGL2 support is isolated so we can toggle the capability probe per test.
vi.mock("@/lib/backdrop/webgl", () => ({ supportsWebGL2: vi.fn(() => true) }));
import { supportsWebGL2 } from "@/lib/backdrop/webgl";
const mockSupportsWebGL2 = vi.mocked(supportsWebGL2);
// jsdom in this vitest config ships a non-functional localStorage (the
// `--localstorage-file` warning above); install an in-memory stub so
// ThemeProvider's localStorage.getItem('theme') works in tests.
const lsStore = new Map<string, string>();
const localStorageStub: Storage = {
  getItem: (k) => lsStore.get(k) ?? null,
  setItem: (k, v) => lsStore.set(k, String(v)),
  removeItem: (k) => lsStore.delete(k),
  clear: () => lsStore.clear(),
  key: (i) => [...lsStore.keys()][i] ?? null,
  get length() { return lsStore.size; },
};
try {
  Object.defineProperty(window, "localStorage", { value: localStorageStub, configurable: true, writable: true });
} catch {
  (window as unknown as { localStorage: Storage }).localStorage = localStorageStub;
}

// jsdom has no matchMedia; provide a parameterised stub.
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
  const result = render(
    <Provider store={store}>
      <ThemeProvider>
        <Backdrop />
      </ThemeProvider>
    </Provider>,
  );
  return { store, ...result };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("theme", "dark"); // matches ThemeProvider default -> no theme change
  document.documentElement.classList.remove("light");
  document.documentElement.classList.add("dark");
  stubMatchMedia({ reducedMotion: false });
  mockSupportsWebGL2.mockReturnValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.clearAllMocks();
});

describe("Backdrop", () => {
  it("always paints the CSS gradient fallback layer", () => {
    renderBackdrop();
    const backdrop = screen.getByTestId("backdrop");
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveAttribute("aria-hidden");
    // softField fallbackClass
    expect(backdrop.className).toContain("bg-gradient-to-br");
    expect(backdrop.className).toContain("dark:");
  });

  it("(a) renders gradient only under prefers-reduced-motion, no canvas", () => {
    stubMatchMedia({ reducedMotion: true });
    renderBackdrop();
    expect(screen.queryByTestId("grain")).not.toBeInTheDocument();
    expect(screen.getByTestId("backdrop").className).toContain("bg-gradient-to-br");
  });

  it("(b) renders gradient only when WebGL2 is unsupported, no canvas", () => {
    mockSupportsWebGL2.mockReturnValue(false);
    renderBackdrop();
    expect(screen.queryByTestId("grain")).not.toBeInTheDocument();
    expect(screen.getByTestId("backdrop").className).toContain("bg-gradient-to-br");
  });

  it("(c) renders exactly one shader canvas with the default wave shape", () => {
    renderBackdrop();
    const grains = screen.getAllByTestId("grain");
    expect(grains).toHaveLength(1);
    expect(grains[0]).toHaveAttribute("data-shape", "wave");
  });

  it("(d) fades to a single sphere canvas after a nightMatte dispatch", () => {
    vi.useFakeTimers();
    const { store } = renderBackdrop();

    expect(screen.getByTestId("grain")).toHaveAttribute("data-shape", "wave");

    act(() => {
      store.dispatch(setBackdropPreset("nightMatte"));
    });

    // During the cross-fade the old + new slots may coexist (never more than 2).
    const during = screen.getAllByTestId("grain");
    expect(during.length).toBeGreaterThanOrEqual(1);
    expect(during.length).toBeLessThanOrEqual(2);

    // After the fade + timeout fallback (~700ms) only the new sphere remains.
    act(() => {
      vi.advanceTimersByTime(800);
    });

    const after = screen.getAllByTestId("grain");
    expect(after).toHaveLength(1);
    expect(after[0]).toHaveAttribute("data-shape", "sphere");
  });

  it("(e-dark) passes the dark palette colorBack to the shader", () => {
    // beforeEach pins theme=dark; no theme change -> stable colorBack.
    renderBackdrop();
    expect(screen.getByTestId("grain")).toHaveAttribute("data-colorback", "#222026");
  });

  it("(e-light) passes the light palette colorBack to the shader", async () => {
    localStorage.setItem("theme", "light");
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");
    renderBackdrop();
    await waitFor(
      () => {
        expect(screen.getByTestId("grain")).toHaveAttribute("data-colorback", "#f7f2e7");
      },
      { timeout: 2000 },
    );
  });
});
