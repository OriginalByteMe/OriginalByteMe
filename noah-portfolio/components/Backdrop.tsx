'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  ColorPanels,
  Dithering,
  GrainGradient,
  MeshGradient,
  Metaballs,
} from '@paper-design/shaders-react';

import { useTheme } from '@/components/ThemeProvider';
import { resolveBackdropPreset, type BackdropPreset } from '@/lib/backdrop/presets';
import { supportsWebGL2 } from '@/lib/backdrop/webgl';
import { selectBackdropPreset } from '@/lib/store/slices/backdrop-slice';

const TWEEN_MS = 900;
const FADE_MS = 600;
/** Removal is timer-driven so it never depends on `transitionend` (jsdom omits it). */
const FADE_REMOVAL_MS = 700;
const MAX_PIXELS_COARSE = 1_600_000;
const MAX_PIXELS_FINE = 4_000_000;

interface BackdropScene {
  preset: BackdropPreset;
  colorBack: string;
  colors: string[];
}

/** One rendered shader layer. Steady state holds exactly one; two only mid cross-fade. */
interface Slot extends BackdropScene {
  id: number;
  opacity: number;
}

function sceneFor(preset: BackdropPreset, theme: 'light' | 'dark'): BackdropScene {
  const palette = theme === 'dark' ? preset.palette.dark : preset.palette.light;
  return { preset, colorBack: palette.colorBack, colors: palette.colors };
}

/**
 * Two scenes can share one canvas (uniform tween) only when they render the
 * same shader component with the same pattern shape and equal color counts;
 * anything else needs a cross-fade to a fresh canvas.
 */
function canTween(a: BackdropScene, b: BackdropScene): boolean {
  const pa = a.preset;
  const pb = b.preset;
  if (pa.shader !== pb.shader) return false;
  if (a.colors.length !== b.colors.length) return false;
  const shapeOf = (p: BackdropPreset) =>
    p.shader === 'grainGradient' || p.shader === 'dithering' ? p.shape : '';
  return shapeOf(pa) === shapeOf(pb);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpHex(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const mix = (shift: number) => {
    const av = (a >> shift) & 0xff;
    const bv = (b >> shift) & 0xff;
    return Math.round(av + (bv - av) * t) & 0xff;
  };
  const value = (mix(16) << 16) | (mix(8) << 8) | mix(0);
  return `#${value.toString(16).padStart(6, '0')}`;
}

/**
 * Belt-and-braces boundary around the shader layer. The library throws WebGL2
 * failures inside an async effect (which boundaries do NOT catch — the
 * `supportsWebGL2()` guard is the real defense); this catches synchronous render
 * errors so the always-painted CSS gradient shows through.
 */
class ShaderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.setState({ hasError: true });
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Renders the right paper-shaders component for a slot's preset family. */
function SlotShader({
  slot,
  maxPixelCount,
}: {
  slot: Slot;
  maxPixelCount: number;
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: slot.opacity,
    transform: 'scale(1.02)',
    filter: 'saturate(1.04)',
    transition: `opacity ${FADE_MS}ms ease`,
  };
  const common = { minPixelRatio: 1, maxPixelCount, style };
  const preset = slot.preset;

  switch (preset.shader) {
    case 'grainGradient':
      return (
        <GrainGradient
          shape={preset.shape}
          colorBack={slot.colorBack}
          colors={slot.colors}
          softness={preset.softness}
          intensity={preset.intensity}
          noise={preset.noise}
          speed={preset.speed}
          {...common}
        />
      );
    case 'meshGradient':
      return (
        <MeshGradient
          colors={slot.colors}
          distortion={preset.distortion}
          swirl={preset.swirl}
          speed={preset.speed}
          {...common}
        />
      );
    case 'metaballs':
      return (
        <Metaballs
          colorBack={slot.colorBack}
          colors={slot.colors}
          count={preset.count}
          size={preset.size}
          speed={preset.speed}
          {...common}
        />
      );
    case 'colorPanels':
      return (
        <ColorPanels
          colorBack={slot.colorBack}
          colors={slot.colors}
          angle1={preset.angle1}
          angle2={preset.angle2}
          length={preset.length}
          edges={preset.edges}
          blur={preset.blur}
          fadeIn={preset.fadeIn}
          fadeOut={preset.fadeOut}
          gradient={preset.gradient}
          density={preset.density}
          speed={preset.speed}
          {...common}
        />
      );
    case 'dithering':
      return (
        <Dithering
          colorBack={slot.colorBack}
          colorFront={slot.colors[0]}
          shape={preset.shape}
          type={preset.type}
          size={preset.pxSize}
          speed={preset.speed}
          {...common}
        />
      );
  }
}

/**
 * Single steerable full-screen backdrop.
 *
 * There is exactly ONE `Backdrop` instance app-wide. Steering happens through the
 * Redux `backdrop.preset` path (`dispatch(setBackdropPreset(name))`); an
 * always-painted CSS gradient covers SSR/first-paint, reduced-motion, and
 * WebGL2-unavailable environments (all three yield gradient-only, zero canvas).
 * Compatible presets (same shader family/shape/color count) tween uniforms on
 * one canvas; anything else cross-fades a second canvas in and drops the old.
 */
export function Backdrop() {
  const presetName = useSelector(selectBackdropPreset);
  const { theme } = useTheme();
  const preset = resolveBackdropPreset(presetName);
  const scene = sceneFor(preset, theme);

  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [webglOk, setWebglOk] = useState(false);
  const [maxPixelCount, setMaxPixelCount] = useState(MAX_PIXELS_FINE);
  const [slots, setSlots] = useState<Slot[]>([]);

  const slotsRef = useRef<Slot[]>([]);
  const sceneRef = useRef(scene);
  const liveColorsRef = useRef<{ colorBack: string; colors: string[] } | null>(null);
  const idRef = useRef(0);
  const tweenRaf = useRef<number | null>(null);
  const fadeRaf = useRef<number | null>(null);
  const removalTimer = useRef<number | undefined>(undefined);

  sceneRef.current = scene;

  const commit = useCallback((next: Slot[]) => {
    slotsRef.current = next;
    setSlots(next);
  }, []);

  // Probe environment once on mount (SSR guard + coarse-pointer pixel cap).
  useEffect(() => {
    setMounted(true);
    setWebglOk(supportsWebGL2());
    if (typeof window !== 'undefined' && window.matchMedia) {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setMaxPixelCount(coarse ? MAX_PIXELS_COARSE : MAX_PIXELS_FINE);
    }
  }, []);

  // Reduced-motion guard: read once and subscribe to changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const active = mounted && !reduced && webglOk;

  // Drive slot content off the resolved target scene.
  useEffect(() => {
    const cancelAnim = () => {
      if (tweenRaf.current !== null) cancelAnimationFrame(tweenRaf.current);
      if (fadeRaf.current !== null) cancelAnimationFrame(fadeRaf.current);
      clearTimeout(removalTimer.current);
      tweenRaf.current = null;
      fadeRaf.current = null;
      removalTimer.current = undefined;
    };

    if (!active) {
      cancelAnim();
      liveColorsRef.current = null;
      if (slotsRef.current.length) commit([]);
      return;
    }

    const target = sceneRef.current;
    const prev = slotsRef.current;
    const current = prev[prev.length - 1];

    // First activation: paint the target immediately, no transition.
    if (!current) {
      liveColorsRef.current = { colorBack: target.colorBack, colors: target.colors };
      commit([{ ...target, id: (idRef.current += 1), opacity: 1 }]);
      return;
    }

    cancelAnim();

    if (canTween(current, target)) {
      // Compatible scenes -> uniform tween (one canvas). Restart mid-flight
      // from the latest live colors and clear any stale teardown timer from a
      // prior cross-fade.
      const start = liveColorsRef.current ?? {
        colorBack: current.colorBack,
        colors: current.colors,
      };
      const latest = { ...current, opacity: 1 };
      commit([latest]);
      let startTime: number | null = null;
      const step = (now: number) => {
        if (startTime === null) startTime = now;
        const e = easeInOutCubic(Math.min(1, (now - startTime) / TWEEN_MS));
        const colorBack = lerpHex(start.colorBack, target.colorBack, e);
        const colors = start.colors.map((c, i) => lerpHex(c, target.colors[i], e));
        liveColorsRef.current = { colorBack, colors };
        commit([
          { ...latest, ...target, colorBack, colors, opacity: 1 },
        ]);
        tweenRaf.current = e < 1 ? requestAnimationFrame(step) : null;
      };
      tweenRaf.current = requestAnimationFrame(step);
      return;
    }

    // Incompatible scenes -> stack the incoming layer on top and cross-fade.
    const incoming: Slot = { ...target, id: (idRef.current += 1), opacity: 0 };
    liveColorsRef.current = { colorBack: target.colorBack, colors: target.colors };
    commit([{ ...current, opacity: 1 }, incoming]);
    fadeRaf.current = requestAnimationFrame(() => {
      fadeRaf.current = null;
      const live = slotsRef.current;
      commit(live.map((s) => (s.id === incoming.id ? { ...s, opacity: 1 } : s)));
    });
    removalTimer.current = window.setTimeout(() => {
      removalTimer.current = undefined;
      commit([{ ...incoming, opacity: 1 }]);
    }, FADE_REMOVAL_MS);
  }, [active, commit, preset.name, theme]);

  // Clean up any pending animation frames / timers on unmount.
  useEffect(
    () => () => {
      if (tweenRaf.current !== null) cancelAnimationFrame(tweenRaf.current);
      if (fadeRaf.current !== null) cancelAnimationFrame(fadeRaf.current);
      clearTimeout(removalTimer.current);
    },
    [],
  );

  return (
    <div
      aria-hidden
      data-testid="backdrop"
      className={`absolute inset-0 h-full w-full overflow-hidden pointer-events-none select-none ${preset.fallbackClass}`}
    >
      <div className="backdrop-paper-base" />
      <div className="backdrop-paper-orbits motion-safe:backdrop-paper-drift" />
      <div className="backdrop-paper-atmosphere motion-safe:backdrop-paper-drift" />
      {active && (
        <ShaderErrorBoundary>
          <div className="absolute inset-0">
            {slots.map((slot) => (
              <SlotShader key={slot.id} slot={slot} maxPixelCount={maxPixelCount} />
            ))}
          </div>
        </ShaderErrorBoundary>
      )}
      <div className="backdrop-paper-grain" />
      <div className="backdrop-paper-depth-mask" />
      <div className="backdrop-paper-vignette" />
    </div>
  );
}

export default Backdrop;
