'use client';

import { Component, type ReactNode } from 'react';
import Image from 'next/image';
import { ImageDithering } from '@paper-design/shaders-react';
import SpotifyReveal from './ui/spotify-reveal';
import ChatBox from './ChatBox';
import { useTheme } from './ThemeProvider';

// Soft Field portrait palette (design-contract v2 §4.1) — violet-ink duotone
// dither that reads well on pastel in BOTH light and dark. The raw hero PNG
// was disconcerting on the light Soft Field backdrop (#41 user feedback).
const PORTRAIT_LIGHT = { colorFront: '#7a5fa0', colorBack: '#f4ecdf', colorHighlight: '#f3d9c8' };
const PORTRAIT_DARK = { colorFront: '#c9b3ec', colorBack: '#26232c', colorHighlight: '#8d7bb0' };

const IDENTITY_FRAGMENTS = ['Full-stack', 'Self-hosted', 'Performance-minded', 'Ask-Me'];

type Tidbit = {
  href: string;
  label: string;
  detail: string;
  external: boolean;
};

const FLOATING_TIDBITS: readonly Tidbit[] = [
  {
    href: 'mailto:noahrijkaard@gmail.com',
    label: 'Email',
    detail: 'noahrijkaard@gmail.com',
    external: false,
  },
  {
    href: 'https://github.com/OriginalByteMe',
    label: 'GitHub',
    detail: 'github.com/OriginalByteMe',
    external: true,
  },
  {
    href: 'https://www.linkedin.com/in/noah-rijkaard/',
    label: 'LinkedIn',
    detail: 'linkedin.com/in/noah-rijkaard',
    external: true,
  },
  {
    href: '#ask-me',
    label: 'Ask the portfolio',
    detail: 'Jump to the live question box',
    external: false,
  },
  {
    href: '#listening',
    label: 'Soundtrack',
    detail: 'Jump to the Spotify reveal',
    external: false,
  },
];

const DESKTOP_TIDBIT_COLUMNS: readonly [ReadonlyArray<Tidbit>, ReadonlyArray<Tidbit>] = [
  FLOATING_TIDBITS.slice(0, 3),
  FLOATING_TIDBITS.slice(3),
];

type TidbitLinkProps = {
  href: string;
  label: string;
  detail: string;
  external?: boolean;
  className?: string;
};

class DitherBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function TidbitLink({ href, label, detail, external = false, className = '' }: TidbitLinkProps) {
  const externalAttrs = external ? { target: '_blank', rel: 'noreferrer noopener' } : {};
  const action = external ? 'Open' : href.startsWith('mailto:') ? 'Email' : 'Jump';

  return (
    <a
      href={href}
      {...externalAttrs}
      className={`hero-tidbit pointer-events-auto group w-full max-w-[17rem] ${className}`}
      aria-label={`${label}: ${detail}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-[hsl(var(--muted-foreground)/0.92)] transition-colors group-hover:text-[hsl(var(--foreground)/0.84)] group-focus-visible:text-[hsl(var(--foreground)/0.84)]">
            {label}
          </span>
          <span className="mt-1 block text-[0.94rem] leading-5 text-[hsl(var(--foreground)/0.86)] transition-transform duration-200 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5">
            {detail}
          </span>
        </span>
        <span className="hero-tidbit-action" aria-hidden>
          {action} →
        </span>
      </span>
    </a>
  );
}

function HeroPortrait() {
  const { theme } = useTheme();
  const p = theme === 'dark' ? PORTRAIT_DARK : PORTRAIT_LIGHT;
  return (
    <figure className="relative mx-auto w-full max-w-[22rem] lg:max-w-[23.5rem]">
      <div className="absolute inset-6 rounded-[2rem] bg-[hsl(var(--card)/0.72)] shadow-[0_28px_80px_-42px_rgba(54,44,72,0.36)] dark:bg-[hsl(var(--card)/0.62)]" />
      <div className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--border)/0.85)] bg-[hsl(var(--card)/0.97)] p-3 shadow-[0_30px_90px_-44px_rgba(52,43,69,0.5)] dark:border-[hsl(var(--border)/0.75)]">
        <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-[hsl(var(--border)/0.7)] bg-[#f7f1e8] dark:bg-[#221f29]">
          <Image
            src="/hero.png"
            alt="Noah Rijkaard"
            fill
            sizes="(max-width: 1024px) 82vw, 22rem"
            priority
            className="object-cover [filter:sepia(0.48)_hue-rotate(240deg)_saturate(1.34)_contrast(1.08)_brightness(0.98)] dark:[filter:sepia(0.62)_hue-rotate(220deg)_saturate(1.75)_contrast(1.14)_brightness(0.76)]"
          />
          <DitherBoundary fallback={null}>
            <ImageDithering
              image="/hero.png"
              colorFront={p.colorFront}
              colorBack={p.colorBack}
              colorHighlight={p.colorHighlight}
              type="8x8"
              size={2}
              colorSteps={3}
              speed={0}
              minPixelRatio={1}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          </DitherBoundary>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/14 via-white/4 to-transparent dark:from-white/6" />
          <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-[1.25rem] border border-[hsl(var(--border)/0.78)] bg-[hsl(var(--card)/0.98)] px-4 py-3 shadow-[0_16px_34px_-24px_rgba(45,38,63,0.45)]">
            <p className="text-[0.64rem] uppercase tracking-[0.36em] text-[hsl(var(--muted-foreground)/0.82)]">
              Focal point
            </p>
            <p className="mt-1 font-serif text-[1.05rem] italic leading-6 text-[hsl(var(--foreground)/0.9)]">
              Calm interfaces, self-hosted systems, and answers that feel human.
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
}

function IdentityChip({ children }: { children: ReactNode }) {
  return <span className="hero-chip">{children}</span>;
}

function TidbitColumn({ items, className = '' }: { items: ReadonlyArray<Tidbit>; className?: string }) {
  return (
    <div className={`pointer-events-auto flex flex-col gap-2.5 ${className}`}>
      {items.map((item, index) => (
        <TidbitLink
          key={item.label}
          href={item.href}
          label={item.label}
          detail={item.detail}
          external={item.external}
          className={index === 1 ? 'ml-5' : index === 2 ? 'ml-1' : ''}
        />
      ))}
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative isolate min-h-screen overflow-hidden px-0">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-24 sm:px-8 lg:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-28">
        <div className="relative order-2 lg:order-1">
          <HeroPortrait />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {IDENTITY_FRAGMENTS.map((fragment) => (
              <IdentityChip key={fragment}>{fragment}</IdentityChip>
            ))}
          </div>

          <p className="mx-auto mt-5 max-w-sm text-center text-sm leading-6 text-[hsl(var(--foreground)/0.76)] lg:mx-0 lg:text-left">
            A portfolio built to feel composed in motion: a portrait, a question box, a soundtrack, and a few quick paths into the work.
          </p>
        </div>

        <div className="relative order-1 lg:order-2">
          <div className="max-w-2xl lg:ml-auto">
            <p className="inline-flex rounded-full border border-[hsl(var(--border)/0.84)] bg-[hsl(var(--card)/0.96)] px-4 py-2 text-[0.65rem] font-medium uppercase tracking-[0.38em] text-[hsl(var(--muted-foreground)/0.9)] shadow-[0_16px_32px_-24px_rgba(51,43,67,0.42)]">
              Ask-Me portfolio
            </p>
            <h1 className="mt-4 max-w-xl text-balance text-5xl font-semibold tracking-[-0.05em] text-[hsl(var(--foreground)/0.94)] sm:text-6xl lg:text-7xl">
              Noah Rijkaard
            </h1>
            <h2 className="mt-4 max-w-xl text-balance text-xl leading-8 text-[hsl(var(--foreground)/0.82)] sm:text-2xl">
              Full-stack developer building calm interfaces, self-hosted systems, and portfolio pages that can answer back.
            </h2>
            <p className="mt-4 max-w-xl text-pretty text-lg leading-8 text-[hsl(var(--foreground)/0.74)]">
              I build self-hosted products, quiet interfaces, and portfolio systems that explain themselves as well as they perform.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Full-stack', 'Self-hosted', 'Performance-minded', 'Open-source friendly'].map((fragment) => (
                <span key={fragment} className="hero-chip text-[0.82rem]">
                  {fragment}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <section id="ask-me" className="hero-panel p-4 sm:p-5">
                <p className="text-[0.64rem] uppercase tracking-[0.34em] text-[hsl(var(--muted-foreground)/0.84)]">
                  Live intro
                </p>
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground)/0.76)]">
                  Ask the site for the longer version of the pitch. The question box is the shortest path from “who is this?” to the actual work.
                </p>
                <div className="-mt-4 sm:-mt-2">
                  <ChatBox />
                </div>
              </section>

              <section id="listening" className="hero-panel p-4 sm:p-5">
                <p className="text-[0.64rem] uppercase tracking-[0.34em] text-[hsl(var(--muted-foreground)/0.84)]">
                  Currently on repeat
                </p>
                <p className="mt-2 text-sm leading-6 text-[hsl(var(--foreground)/0.76)]">
                  The soundtrack is part mood board, part working rhythm. Tap it to see what’s shaping the page.
                </p>
                <div className="mt-3">
                  <SpotifyReveal />
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <aside aria-label="Quick links" className="pointer-events-none absolute inset-x-0 top-6 hidden lg:block">
        <div className="mx-auto flex max-w-6xl justify-between gap-4 px-5">
          <TidbitColumn items={DESKTOP_TIDBIT_COLUMNS[0]} className="hero-float-slow" />
          <TidbitColumn items={DESKTOP_TIDBIT_COLUMNS[1]} className="hero-float-fast pt-10" />
        </div>
      </aside>

      <div className="mx-auto mt-8 flex w-full max-w-6xl flex-wrap justify-center gap-3 px-6 pb-8 lg:hidden">
        {FLOATING_TIDBITS.map((item) => (
          <TidbitLink key={item.label} href={item.href} label={item.label} detail={item.detail} external={item.external} />
        ))}
      </div>
    </section>
  );
}
