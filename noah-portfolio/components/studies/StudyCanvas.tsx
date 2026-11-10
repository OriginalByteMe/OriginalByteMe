'use client';

import { useEffect, useRef } from 'react';

import { PALETTES, STUDIES, mountStudy, type Mounted, type Palette, type StudyOptions } from '@/lib/studies';

export interface StudyCanvasProps extends StudyOptions {
  /** A study id: ink, lattice, tide, contours, vase, forms, silk. */
  study: string;
  /** A palette id (dusk, tide, ember, kente, bone, paper) or a palette object. */
  palette?: string | Palette;
  variant?: number;
  className?: string;
}

/** One study on its own canvas. It fills its box, so give it a sized parent or className. */
export default function StudyCanvas({
  study,
  palette = 'dusk',
  variant = 0,
  className,
  image,
  fit,
  imageScale,
  density,
}: StudyCanvasProps) {
  const imageKey = JSON.stringify(image ?? null);
  const ref = useRef<HTMLCanvasElement>(null);
  const mounted = useRef<Mounted | null>(null);

  useEffect(() => {
    const def = STUDIES.find((s) => s.id === study);
    // No observers means no real browser (tests, very old engines): leave the canvas blank.
    if (!ref.current || !def || typeof IntersectionObserver === 'undefined') return;
    const m = mountStudy(ref.current, def, PALETTES[0], 0, {
      image: imageKey === 'null' ? undefined : JSON.parse(imageKey),
      fit,
      imageScale,
      density,
    });
    mounted.current = m;
    return () => {
      m?.destroy();
      mounted.current = null;
    };
  }, [study, imageKey, fit, imageScale, density]);

  const palKey = typeof palette === 'string' ? palette : JSON.stringify(palette);
  useEffect(() => {
    const pal = palKey.startsWith('{') ? (JSON.parse(palKey) as Palette) : (PALETTES.find((p) => p.id === palKey) ?? PALETTES[0]);
    mounted.current?.set({ pal, variant });
  }, [study, palKey, variant, imageKey, fit, imageScale, density]);

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
