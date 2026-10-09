import type { ReactNode } from "react";

/** Every piece shares one 240×180 canvas, a ground shadow and inherited ink outlines. */
export function Frame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 180" className="art-svg" aria-hidden="true" focusable="false">
      <ellipse cx="120" cy="166" rx="74" ry="7" fill="var(--site-ink)" opacity="0.12" />
      <g
        fill="none"
        stroke="var(--site-ink)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </g>
    </svg>
  );
}

export interface ArtPiece {
  /** One short line the model reads when choosing a picture. */
  description: string;
  animated: boolean;
  Svg: () => ReactNode;
}
