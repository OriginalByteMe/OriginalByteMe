'use client';

import { useEffect, useRef } from 'react';

import {
  CosmosEngine,
  paletteById,
  type CosmosOptions,
  type SceneId,
  type StyleId,
} from '@/lib/cosmos';

export interface CosmosCanvasProps extends CosmosOptions {
  scene: SceneId;
  variant?: number;
  style?: StyleId;
  palette?: string;
  /** 0..1 to drive the scene yourself (e.g. from scroll). Omit to let it loop. */
  progress?: number;
  className?: string;
}

/**
 * One scene in one style on its own canvas. Decorative by default; pass a
 * className that gives it a size (it fills its box).
 */
export default function CosmosCanvas({
  scene,
  variant = 0,
  style = 'raw',
  palette = 'nocturne',
  progress,
  className,
  maxScenePixels,
  pointer,
  reducedMotion,
}: CosmosCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const engine = useRef<CosmosEngine | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const reduce =
      reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const e = new CosmosEngine(ref.current, { maxScenePixels, pointer, reducedMotion: reduce });
    engine.current = e;
    e.start();
    return () => {
      e.dispose();
      engine.current = null;
    };
  }, [maxScenePixels, pointer, reducedMotion]);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.frame = {
      ...e.frame,
      a: scene,
      b: scene,
      mix: 0,
      styleA: style,
      styleB: style,
      varA: variant,
      progA: progress ?? -1,
      palette: paletteById(palette),
    };
  }, [scene, variant, style, palette, progress, maxScenePixels, pointer, reducedMotion]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
