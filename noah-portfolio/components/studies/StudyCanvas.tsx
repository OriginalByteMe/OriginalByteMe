'use client';

import { useEffect, useRef } from 'react';

import { PALETTES, STUDIES, mountStudy, type Mounted } from '@/lib/studies';

export interface StudyCanvasProps {
  /** A study id: forms, horizon, ink, silk, contours, vase, pulsar, lattice, tide. */
  study: string;
  /** A palette id: dusk, tide, ember, kente, bone, paper. */
  palette?: string;
  variant?: number;
  className?: string;
}

/** One study on its own canvas. It fills its box, so give it a sized parent or className. */
export default function StudyCanvas({ study, palette = 'dusk', variant = 0, className }: StudyCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mounted = useRef<Mounted | null>(null);

  useEffect(() => {
    const def = STUDIES.find((s) => s.id === study);
    if (!ref.current || !def) return;
    const m = mountStudy(ref.current, def, PALETTES[0]);
    mounted.current = m;
    return () => {
      m?.destroy();
      mounted.current = null;
    };
  }, [study]);

  useEffect(() => {
    mounted.current?.set({ pal: PALETTES.find((p) => p.id === palette) ?? PALETTES[0], variant });
  }, [study, palette, variant]);

  return (
    <canvas
      key={study}
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
