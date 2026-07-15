'use client';

import React, { useEffect, useState } from 'react';
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

const MAX_PIXELS_COARSE = 1_600_000;
const MAX_PIXELS_FINE = 4_000_000;
const SHADER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
};

/**
 * Belt-and-braces boundary around the shader layer. WebGL capability is guarded
 * before mount; this catches synchronous component failures so the CSS scene
 * remains painted instead of taking the page down.
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

/** Renders exactly one Paper Shaders component for the selected preset. */
function PresetShader({
  preset,
  colorBack,
  colors,
  maxPixelCount,
}: {
  preset: BackdropPreset;
  colorBack: string;
  colors: string[];
  maxPixelCount: number;
}) {
  const sizing = { minPixelRatio: 1, maxPixelCount, style: SHADER_STYLE };

  switch (preset.shader) {
    case 'grainGradient':
      return (
        <GrainGradient
          shape={preset.shape}
          colorBack={colorBack}
          colors={colors}
          softness={preset.softness}
          intensity={preset.intensity}
          noise={preset.noise}
          speed={preset.speed}
          {...sizing}
        />
      );
    case 'meshGradient':
      return (
        <MeshGradient
          colors={colors}
          distortion={preset.distortion}
          swirl={preset.swirl}
          speed={preset.speed}
          {...sizing}
        />
      );
    case 'metaballs':
      return (
        <Metaballs
          colorBack={colorBack}
          colors={colors}
          count={preset.count}
          size={preset.size}
          speed={preset.speed}
          {...sizing}
        />
      );
    case 'colorPanels':
      return (
        <ColorPanels
          colorBack={colorBack}
          colors={colors}
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
          {...sizing}
        />
      );
    case 'dithering':
      return (
        <Dithering
          colorBack={colorBack}
          colorFront={colors[0]}
          shape={preset.shape}
          type={preset.type}
          size={preset.pxSize}
          speed={preset.speed}
          {...sizing}
        />
      );
  }
}

/**
 * The app-wide backdrop: one steerable shader canvas plus a CSS-only nocturne
 * scene. CSS remains fully painted during SSR, reduced motion, WebGL fallback,
 * and synchronous shader failure. Preset updates replace props on the single
 * mounted shader rather than overlapping canvases.
 */
export function Backdrop() {
  const presetName = useSelector(selectBackdropPreset);
  const { theme } = useTheme();
  const preset = resolveBackdropPreset(presetName);
  const palette = preset.palette[theme];

  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [webglOk, setWebglOk] = useState(false);
  const [maxPixelCount, setMaxPixelCount] = useState(MAX_PIXELS_FINE);

  useEffect(() => {
    setMounted(true);
    setWebglOk(supportsWebGL2());
    if (typeof window !== 'undefined' && window.matchMedia) {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setMaxPixelCount(coarse ? MAX_PIXELS_COARSE : MAX_PIXELS_FINE);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const shaderActive = mounted && !reduced && webglOk;

  return (
    <div
      aria-hidden="true"
      data-testid="backdrop"
      data-preset={preset.name}
      data-shape={preset.shader === 'dithering' ? preset.shape : preset.shader}
      data-shader-active={shaderActive ? 'true' : 'false'}
      className={`backdrop-root fixed inset-0 w-full overflow-hidden pointer-events-none select-none ${preset.fallbackClass}`}
    >
      <div className="backdrop-paper-base" />
      <div className="backdrop-paper-orbits motion-safe:backdrop-paper-drift" />
      <div className="backdrop-paper-atmosphere motion-safe:backdrop-paper-drift" />
      {shaderActive && (
        <ShaderErrorBoundary>
          <div className="backdrop-shader-layer absolute inset-0">
            <PresetShader
              preset={preset}
              colorBack={palette.colorBack}
              colors={palette.colors}
              maxPixelCount={maxPixelCount}
            />
          </div>
        </ShaderErrorBoundary>
      )}
      <div
        aria-hidden="true"
        data-backdrop-scene
        data-chapter="hero"
        data-testid="backdrop-scene"
        className="backdrop-nocturne-scene"
      >
        <div className="backdrop-perspective-grid" />
        <div className="backdrop-perspective-rings">
          <span />
          <span />
          <span />
        </div>

        <div className="backdrop-wave-contours">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="backdrop-ark-mark">
          <span className="backdrop-ark-layer backdrop-ark-layer-far" />
          <span className="backdrop-ark-layer backdrop-ark-layer-mid" />
          <span className="backdrop-ark-layer backdrop-ark-layer-front" />
        </div>

        <div className="backdrop-flecks">
          <span className="backdrop-fleck backdrop-fleck-a" />
          <span className="backdrop-fleck backdrop-fleck-b" />
          <span className="backdrop-fleck backdrop-fleck-c" />
          <span className="backdrop-fleck backdrop-fleck-d" />
          <span className="backdrop-fleck backdrop-fleck-e" />
          <span className="backdrop-fleck backdrop-fleck-f" />
          <span className="backdrop-fleck backdrop-fleck-g" />
        </div>
      </div>
      <div className="backdrop-paper-grain" />
      <div className="backdrop-paper-depth-mask" />
      <div className="backdrop-paper-vignette" />
    </div>
  );
}

export default Backdrop;
