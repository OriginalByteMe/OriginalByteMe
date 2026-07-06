import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, renderHook, cleanup } from "@testing-library/react";
import { Provider } from "react-redux";
import type { ReactNode } from "react";

import { makeStore } from "@/lib/store";
import { HOLIDAY_THEMES } from "@/lib/themes/registry";
import {
  HolidayThemeProvider,
  useTheme,
  HolidayThemeApplier,
} from "@/lib/themes/provider";

// useTheme snapshots `new Date()` once at mount, so the system clock MUST be
// pinned BEFORE render. Explicit-arg dates are LOCAL wall-clock (see registry
// test rationale) and therefore timezone-stable.
const HALLOWEEN = new Date(2026, 9, 31, 12); // Oct 31 2026
const CHRISTMAS = new Date(2026, 11, 25, 12); // Dec 25 2026
const ORDINARY = new Date(2026, 6, 6, 12); // Jul 6 2026, no holiday

function providerWrapper(country: string | null) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <HolidayThemeProvider country={country}>{children}</HolidayThemeProvider>;
  }
  Wrapper.displayName = "providerWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useTheme", () => {
  it("resolves the gated Halloween theme for a matching country", () => {
    vi.setSystemTime(HALLOWEEN);
    const { result } = renderHook(() => useTheme(), {
      wrapper: providerWrapper("US"),
    });
    expect(result.current).toBe(HOLIDAY_THEMES.halloween);
  });

  it("returns null when the country fails the locale gate", () => {
    vi.setSystemTime(HALLOWEEN);
    const { result } = renderHook(() => useTheme(), {
      wrapper: providerWrapper("FR"),
    });
    expect(result.current).toBeNull();
  });

  it("returns null on a non-holiday date", () => {
    vi.setSystemTime(ORDINARY);
    const { result } = renderHook(() => useTheme(), {
      wrapper: providerWrapper("US"),
    });
    expect(result.current).toBeNull();
  });

  it("resolves a global theme via the un-providered default context (country=null)", () => {
    vi.setSystemTime(CHRISTMAS);
    const { result } = renderHook(() => useTheme());
    expect(result.current).toBe(HOLIDAY_THEMES.christmas);
  });
});

describe("HolidayThemeApplier", () => {
  function renderApplier(store = makeStore(), country: string | null = "US") {
    return render(
      <Provider store={store}>
        <HolidayThemeProvider country={country}>
          <HolidayThemeApplier />
        </HolidayThemeProvider>
      </Provider>,
    );
  }

  it("drives the backdrop preset to the active theme and restores it on unmount", () => {
    vi.setSystemTime(HALLOWEEN);
    const store = makeStore();
    expect(store.getState().backdrop.preset).toBe("softField");

    const { unmount } = renderApplier(store, "US");
    expect(store.getState().backdrop.preset).toBe("nightMatte");

    unmount();
    expect(store.getState().backdrop.preset).toBe("softField");
  });

  it("leaves the default preset untouched when no theme is active", () => {
    vi.setSystemTime(ORDINARY);
    const store = makeStore();
    renderApplier(store, "US");
    expect(store.getState().backdrop.preset).toBe("softField");
  });
});
