'use client';

import { Component, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { ImageDithering } from '@paper-design/shaders-react';
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useSelector } from 'react-redux';
import { Github, Linkedin, Mail, X } from 'lucide-react';
import ChatBox from './ChatBox';
import { AskLauncherButton } from './AskDock';
import { useTheme } from './ThemeProvider';
import { ditherPaletteFromTrack, type DitherPalette } from '@/lib/dither-palette';
import type { RootState } from '@/lib/store';

const PORTRAIT_LIGHT: DitherPalette = { colorFront: '#7a5fa0', colorBack: '#f4ecdf', colorHighlight: '#f3d9c8' };
const PORTRAIT_DARK: DitherPalette = { colorFront: '#c9b3ec', colorBack: '#26232c', colorHighlight: '#8d7bb0' };
const ICON = { strokeWidth: 1.5 } as const;

/** Max pointer-driven tilt of the picture plane, in degrees. */
const TILT_DEG = 9;

class DitherBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * The dither's own choreography: the Bayer grid stays fixed to the screen
 * (see the shader's sizing note) while the image beneath it slowly breathes
 * and sways, and the grid's pixel size pulses — so the dither visibly runs
 * *through* the portrait instead of being a frozen filter. Values are gentle
 * on purpose; out-of-frame area renders colorBack, which matches the card.
 */
const DITHER_REST = { scale: 1.08, rotation: 0, size: 2 };

function HeroPortrait() {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const selectedTrack = useSelector((state: RootState) => state.spotify.selectedTrack);

  const basePalette = theme === 'dark' ? PORTRAIT_DARK : PORTRAIT_LIGHT;
  // A soundtrack pick (the wand on a SpotifyPill) retints the dither with the
  // album art's palette; deselecting falls back to the theme trio.
  const palette = useMemo(
    () => ditherPaletteFromTrack(selectedTrack?.colourPalette, theme === 'dark', basePalette),
    [selectedTrack, theme, basePalette],
  );

  // Pointer-driven 3D tilt of the picture plane (springed so it glides).
  const tiltX = useSpring(useMotionValue(0), { stiffness: 140, damping: 18 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 140, damping: 18 });

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (reducedMotion) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      tiltY.set(x * TILT_DEG * 2);
      tiltX.set(-y * TILT_DEG * 2);
    },
    [reducedMotion, tiltX, tiltY],
  );

  const handlePointerLeave = useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
  }, [tiltX, tiltY]);

  // Dither pulse loop (~30fps is plenty for a slow breathe).
  const [dither, setDither] = useState(DITHER_REST);
  const lastFrame = useRef(0);
  useAnimationFrame((t) => {
    if (reducedMotion) return;
    if (t - lastFrame.current < 33) return;
    lastFrame.current = t;
    const s = t / 1000;
    setDither({
      scale: 1.1 + 0.04 * Math.sin(s * 0.55),
      rotation: (360 + 3 * Math.sin(s * 0.21)) % 360,
      size: 2.1 + 0.9 * (0.5 + 0.5 * Math.sin(s * 0.8)),
    });
  });

  return (
    <figure
      data-testid="hero-portrait"
      className="profile-portrait relative mx-auto w-full max-w-[34rem]"
      style={{ perspective: 1200 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute inset-5 rounded-[2.75rem] bg-[#f4ecdf] shadow-[0_32px_90px_-42px_rgba(58,51,69,0.5)] dark:bg-[#26232c]" />
      <motion.div
        style={{ transformStyle: 'preserve-3d' }}
        animate={
          reducedMotion
            ? undefined
            : { rotateY: [-2.5, 2.5, -2.5], rotateX: [1.5, -1.5, 1.5] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
          className="relative overflow-hidden rounded-[2.75rem] border border-[#37304a]/10 bg-[#fffdf8] p-3 shadow-[0_28px_80px_-40px_rgba(58,51,69,0.5)] dark:border-white/10 dark:bg-[#2b2830]"
        >
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2.15rem] bg-[#f4ecdf] dark:bg-[#26232c]">
            <Image
              src="/hero.png"
              alt="Portrait of Noah Rijkaard"
              fill
              sizes="(max-width: 1023px) calc(100vw - 2.5rem), 34rem"
              priority
              className="object-cover [filter:sepia(0.48)_hue-rotate(240deg)_saturate(1.34)_contrast(1.08)] dark:[filter:sepia(0.62)_hue-rotate(220deg)_saturate(1.65)_contrast(1.12)_brightness(0.78)]"
            />
            <div aria-hidden className="absolute inset-0">
              <DitherBoundary fallback={null}>
                <ImageDithering
                  image="/hero.png"
                  colorFront={palette.colorFront}
                  colorBack={palette.colorBack}
                  colorHighlight={palette.colorHighlight}
                  type="8x8"
                  size={dither.size}
                  colorSteps={3}
                  scale={dither.scale}
                  rotation={dither.rotation}
                  fit="cover"
                  minPixelRatio={1}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />
              </DitherBoundary>
            </div>
          </div>
          <figcaption className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
            hero.png · 8×8 ordered dither{selectedTrack ? ` · tinted by ${selectedTrack.title}` : ''} · Noah Rijkaard
          </figcaption>
        </motion.div>
      </motion.div>
    </figure>
  );
}

function HeroAskLauncher() {
  const [expanded, setExpanded] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const collapse = () => {
    launcherRef.current?.focus();
    setExpanded(false);
  };

  return (
    <section
      id="ask-me"
      aria-label="Ask-Me"
      className="profile-ask profile-ask-launcher"
      data-state={expanded ? 'expanded' : 'collapsed'}
    >
      <div className="profile-ask-launcher__entry">
        <AskLauncherButton
          ref={launcherRef}
          aria-label={expanded ? 'Ask-Me composer is open' : 'Open Ask-Me composer'}
          aria-expanded={expanded}
          aria-controls="ask-me-composer"
          aria-describedby={expanded ? undefined : 'ask-me-cta'}
          onClick={() => setExpanded(true)}
        />
        {!expanded && (
          <p id="ask-me-cta" className="profile-ask-launcher__cta">
            Ask this portfolio anything
          </p>
        )}
      </div>

      {expanded && (
        <div id="ask-me-composer" className="profile-ask-launcher__composer">
          <div className="ask-editorial__heading">
            <div>
              <p className="ask-editorial__eyebrow">Ask-Me</p>
              <h2 className="ask-editorial__title">Where should we begin?</h2>
            </div>
            <button
              type="button"
              aria-label="Collapse Ask-Me"
              onClick={collapse}
              className="hero-action size-11 shrink-0 justify-center rounded-full"
            >
              <X {...ICON} className="size-4" aria-hidden />
            </button>
          </div>
          <p className="ask-editorial__intro">
            Choose a route below or write your own. The portfolio will compose an answer around your question.
          </p>
          <ChatBox variant="editorial" autoFocus />
        </div>
      )}
    </section>
  );
}

export default function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="profile-heading"
      className="relative isolate overflow-hidden px-5 pb-20 pt-7 text-[#37304a] dark:text-[#eae6f2] sm:px-8 lg:min-h-screen lg:px-10 lg:py-10"
    >
      <div className="profile-hero-grid mx-auto w-full max-w-[92rem]">
        <header className="profile-identity self-end text-center lg:text-left">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#6f6885] dark:text-[#a9a2bd]">
            Ask-Me portfolio
          </p>
          <h1 id="profile-heading" className="mt-3 text-balance font-serif text-[clamp(3.2rem,7vw,7rem)] leading-[0.9] tracking-tight">
            Noah <em className="block italic text-[#5646a8] dark:text-[#9d8ff2]">Rijkaard</em>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-pretty text-lg leading-relaxed text-[#5d5673] dark:text-[#bdb6d0] lg:mx-0">
            Full-stack developer building calm interfaces, self-hosted systems, and portfolio pages that answer back.
          </p>
        </header>

        <div className="profile-portrait-cell">
          <div className="profile-portrait-shell">
            <HeroPortrait />
            <nav aria-label="Contact destinations" className="profile-contact-actions">
              <a
                className="profile-contact-action"
                data-contact-anchor="upper-left"
                href="mailto:noahrijkaard@gmail.com"
                aria-label="Email Noah"
                aria-describedby="contact-tooltip-email"
              >
                <Mail {...ICON} aria-hidden />
                <span id="contact-tooltip-email" role="tooltip">Email me</span>
              </a>
              <a
                className="profile-contact-action"
                data-contact-anchor="middle-right"
                href="https://github.com/OriginalByteMe"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Visit Noah on GitHub"
                aria-describedby="contact-tooltip-github"
              >
                <Github {...ICON} aria-hidden />
                <span id="contact-tooltip-github" role="tooltip">See my GitHub</span>
              </a>
              <a
                className="profile-contact-action"
                data-contact-anchor="lower-left"
                href="https://www.linkedin.com/in/noah-rijkaard/"
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Visit Noah on LinkedIn"
                aria-describedby="contact-tooltip-linkedin"
              >
                <Linkedin {...ICON} aria-hidden />
                <span id="contact-tooltip-linkedin" role="tooltip">Connect on LinkedIn</span>
              </a>
            </nav>
          </div>
        </div>

        <HeroAskLauncher />
      </div>
    </section>
  );
}
