'use client';

import { Component, type ReactNode } from 'react';
import Image from 'next/image';
import { ImageDithering } from '@paper-design/shaders-react';
import { ArrowDown, ArrowUpRight, Github, Linkedin, Mail } from 'lucide-react';
import SpotifyReveal from './ui/spotify-reveal';
import AskMeLauncher from './AskMeLauncher';
import { ThemeSwitch } from './ThemeSwitch';
import { useTheme } from './ThemeProvider';

const PORTRAIT_LIGHT = { colorFront: '#7a5fa0', colorBack: '#f4ecdf', colorHighlight: '#f3d9c8' };
const PORTRAIT_DARK = { colorFront: '#c9b3ec', colorBack: '#26232c', colorHighlight: '#8d7bb0' };
const ICON = { strokeWidth: 1.5 } as const;

class DitherBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const actionClass = 'hero-action min-h-11 rounded-full px-4 text-sm font-medium';

function HeroPortrait() {
  const { theme } = useTheme();
  const palette = theme === 'dark' ? PORTRAIT_DARK : PORTRAIT_LIGHT;

  return (
    <figure data-testid="hero-portrait" className="profile-portrait relative mx-auto w-full max-w-[34rem]">
      <div className="absolute inset-5 rounded-[2.75rem] bg-[#f4ecdf] shadow-[0_32px_90px_-42px_rgba(58,51,69,0.5)] dark:bg-[#26232c]" />
      <div className="relative overflow-hidden rounded-[2.75rem] border border-[#37304a]/10 bg-[#fffdf8] p-3 shadow-[0_28px_80px_-40px_rgba(58,51,69,0.5)] dark:border-white/10 dark:bg-[#2b2830]">
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
                size={2}
                colorSteps={3}
                speed={0}
                minPixelRatio={1}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              />
            </DitherBoundary>
          </div>
        </div>
        <figcaption className="px-3 pb-1 pt-3 font-mono text-[10px] uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
          hero.png · 8×8 ordered dither · Noah Rijkaard
        </figcaption>
      </div>
    </figure>
  );
}

export default function Hero() {
  return (
    <section aria-labelledby="profile-heading" className="relative isolate overflow-hidden px-5 pb-20 pt-7 text-[#37304a] dark:text-[#eae6f2] sm:px-8 lg:min-h-screen lg:px-10 lg:py-10">
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

        <nav aria-label="Primary navigation" className="profile-nav flex flex-wrap items-center justify-center gap-2 lg:justify-end lg:self-start">
          <a className={actionClass} href="#story" aria-label="Read Noah's story">
            Story <ArrowDown {...ICON} className="size-4" aria-hidden />
          </a>
          <a className={actionClass} href="https://blog.noahrijkaard.com" target="_blank" rel="noreferrer noopener" aria-label="Read Noah's blog">
            Blog <ArrowUpRight {...ICON} className="size-4" aria-hidden />
          </a>
        </nav>

        <div className="profile-portrait-cell">
          <HeroPortrait />
        </div>

        <aside aria-label="Contact and destinations" className="profile-contact profile-support hero-panel p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6f6885] dark:text-[#a9a2bd]">Find me</p>
          <div className="mt-3 grid gap-2">
            <a className={actionClass} href="mailto:noahrijkaard@gmail.com" aria-label="Email Noah">
              <Mail {...ICON} className="size-4" aria-hidden /> Email
            </a>
            <a className={actionClass} href="https://github.com/OriginalByteMe" target="_blank" rel="noreferrer noopener" aria-label="Visit Noah on GitHub">
              <Github {...ICON} className="size-4" aria-hidden /> GitHub
            </a>
            <a className={actionClass} href="https://www.linkedin.com/in/noah-rijkaard/" target="_blank" rel="noreferrer noopener" aria-label="Visit Noah on LinkedIn">
              <Linkedin {...ICON} className="size-4" aria-hidden /> LinkedIn
            </a>
            <ThemeSwitch />
          </div>
        </aside>

        <section data-testid="compact-spotify" aria-labelledby="listening-heading" className="profile-listening profile-support hero-panel min-w-0 p-8">
          <p id="listening-heading" className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6f6885] dark:text-[#a9a2bd]">Listening context</p>
          <SpotifyReveal />
        </section>

        <section id="ask-me" aria-label="Ask-Me" className="profile-ask profile-support hero-panel min-w-0 p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#6f6885] dark:text-[#a9a2bd]">Ask-Me</p>
          <AskMeLauncher />
        </section>
      </div>
    </section>
  );
}
