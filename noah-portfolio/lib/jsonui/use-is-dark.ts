"use client";

import { useEffect, useState } from "react";

/**
 * Shared dark-mode flag for jsonui components (design contract §3.4).
 *
 * `components/ThemeProvider` owns the light/dark colour scheme. The separate
 * `lib/themes/provider.tsx` module handles holiday/locale overlays; this hook
 * observes the same `<html>` class that the scheme provider updates.
 * The original sections (`Projects.tsx`, `About.tsx`) each derive dark-mode
 * locally by watching the `<html>` element's `class` attribute via
 * `MutationObserver`; this is that same pattern extracted once so every
 * catalog component that needs `lightImage`/`darkImage` variants shares one
 * implementation.
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          setIsDark(document.documentElement.classList.contains("dark"));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return isDark;
}
