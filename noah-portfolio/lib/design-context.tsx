"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type DesignVariant = "terminal" | "neural" | "minimal";

export const DESIGN_VARIANTS: {
  id: DesignVariant;
  label: string;
  hint: string;
}[] = [
  { id: "terminal", label: "Terminal", hint: "CRT phosphor / hacker den" },
  { id: "neural", label: "Neural", hint: "agentic constellation glow" },
  { id: "minimal", label: "Mono", hint: "clean studio monochrome" },
];

const STORAGE_KEY = "portfolio-design-variant";

type DesignContextType = {
  design: DesignVariant;
  setDesign: (d: DesignVariant) => void;
};

const DesignContext = createContext<DesignContextType | undefined>(undefined);

export function DesignProvider({ children }: { children: ReactNode }) {
  const [design, setDesignState] = useState<DesignVariant>("terminal");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as DesignVariant | null;
    if (saved && DESIGN_VARIANTS.some((v) => v.id === saved)) {
      setDesignState(saved);
    }
  }, []);

  const setDesign = (d: DesignVariant) => {
    setDesignState(d);
    localStorage.setItem(STORAGE_KEY, d);
  };

  return (
    <DesignContext.Provider value={{ design, setDesign }}>
      {children}
    </DesignContext.Provider>
  );
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign must be used within a DesignProvider");
  return ctx;
}
