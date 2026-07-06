'use client';

/**
 * PROTOTYPE for ticket #35 — pastel/matte + dither/halftone art direction.
 *
 * THROWAWAY aesthetic playground. Three clearly-labeled candidate looks;
 * Noah scrolls through and picks a winner in ticket #36. Nothing here is
 * meant to be extracted or reused — delete the whole route once decided.
 *
 * Rules honored on this page:
 *   - no backdrop-blur / glassmorphism anywhere (matte = solid opaque fills)
 *   - every shader gets minPixelRatio={1}
 *   - prefers-reduced-motion forces every shader speed to 0
 *   - shader color arrays are module constants (stable identities, so theme
 *     switches swap one stable reference — no per-render uniform churn)
 */

import { useEffect, useState } from 'react';
import {
  GrainGradient,
  HalftoneDots,
  ImageDithering,
} from '@paper-design/shaders-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  ArrowUpRight,
  AtSign,
  Code2,
  GitBranch,
  Globe,
  Layers,
  Mail,
  Newspaper,
  Printer,
  Sparkles,
  Terminal,
} from 'lucide-react';

/* One consistent icon treatment everywhere (ingredient d). */
const ICON = { strokeWidth: 1.5 } as const;

/* ------------------------------------------------------------------ */
/* Shader palettes — module-level constants so array identities are    */
/* stable across renders; the theme switch swaps whole objects.        */
/* ------------------------------------------------------------------ */

const SOFT_FIELD = {
  light: { colorBack: '#f7f2e7', colors: ['#dcc8f0', '#f8d7c4', '#cfe7d6', '#f4e3c2'] },
  dark: { colorBack: '#222026', colors: ['#5e5175', '#75564e', '#4d6154', '#6e6550'] },
};

const SOFT_FIELD_PORTRAIT = {
  light: { colorFront: '#7a5fa0', colorBack: '#f4ecdf', colorHighlight: '#f3d9c8' },
  dark: { colorFront: '#c9b3ec', colorBack: '#26232c', colorHighlight: '#8d7bb0' },
};

const SOFT_FIELD_RULE = {
  light: { colorFront: '#7a5fa0', colorBack: '#f7f2e7' },
  dark: { colorFront: '#c9b3ec', colorBack: '#222026' },
};

const PRINT_BAND = {
  light: { colorBack: '#f2ecdc', colors: ['#d6467e', '#33639f'] },
  dark: { colorBack: '#171410', colors: ['#f09cc0', '#8fb4e0'] },
};

const PRINT_IMAGE = {
  light: { colorFront: '#33639f', colorBack: '#f2ecdc', colorHighlight: '#d6467e' },
  dark: { colorFront: '#f09cc0', colorBack: '#1c1813', colorHighlight: '#8fb4e0' },
};

const NIGHT_BENTO = {
  light: { colorBack: '#e9e7ef', colors: ['#bcc9e6', '#cdb7e0', '#eec6d5', '#bfe2d8'] },
  dark: { colorBack: '#141319', colors: ['#9d8ff2', '#6ea3e8', '#ef9cc2', '#7fe0bd'] },
};

const NIGHT_TILE = {
  light: { colorFront: '#5646a8', colorBack: '#f6f4f9' },
  dark: { colorFront: '#7fe0bd', colorBack: '#211f29' },
};

/* ------------------------------------------------------------------ */
/* Hooks & scaffolding                                                 */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Debug-style label chip: deliberately NOT part of any candidate design. */
function CandidateChip({ label }: { label: string }) {
  return (
    <div className="absolute left-4 top-4 z-40 rounded-md border-2 border-dashed border-yellow-400 bg-zinc-950 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-yellow-300 shadow-lg">
      {label}
    </div>
  );
}

const SHADER_FILL = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
} as const;

/* ------------------------------------------------------------------ */
/* Candidate A — “Soft Field”: airy editorial                          */
/* ------------------------------------------------------------------ */

function SoftField({ reduced }: { reduced: boolean }) {
  const dark = useTheme().theme === 'dark';
  const grain = dark ? SOFT_FIELD.dark : SOFT_FIELD.light;
  const portrait = dark ? SOFT_FIELD_PORTRAIT.dark : SOFT_FIELD_PORTRAIT.light;
  const rule = dark ? SOFT_FIELD_RULE.dark : SOFT_FIELD_RULE.light;

  return (
    <section className="relative min-h-screen overflow-hidden text-[#37304a] dark:text-[#eae6f2]">
      <CandidateChip label="Candidate A — Soft Field" />

      {/* Full-bleed pastel grain backdrop; CSS gradient = pre-hydration fallback */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-gradient-to-br from-[#f2e7d9] via-[#e7dcf1] to-[#dcead9] dark:from-[#252129] dark:via-[#2a2430] dark:to-[#232820]"
      >
        <GrainGradient
          style={SHADER_FILL}
          colorBack={grain.colorBack}
          colors={grain.colors}
          shape="wave"
          softness={0.85}
          intensity={0.4}
          noise={0.3}
          speed={reduced ? 0 : 0.35}
          minPixelRatio={1}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32 md:px-10">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-[#6f6885] dark:text-[#a9a2bd]">
          Portfolio · 2026
        </p>

        {/* Display typography moment (ingredient e) */}
        <h2 className="max-w-4xl font-serif text-[clamp(3.5rem,9vw,8rem)] leading-[0.92] tracking-tight">
          Softer <em className="italic">systems</em>, sturdier software.
        </h2>

        <p className="mt-8 max-w-md text-lg leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
          Noah Rijkaard — software engineer. Backend services, thoughtful
          interfaces, and lately: LLM-driven products that answer for
          themselves.
        </p>

        {/* Halftone rule accent (ingredient b) */}
        <div
          aria-hidden
          className="relative mt-14 h-12 w-full max-w-3xl overflow-hidden rounded-full bg-[#efe6da] dark:bg-[#2a2630]"
        >
          <HalftoneDots
            style={SHADER_FILL}
            image="/hero.png"
            colorFront={rule.colorFront}
            colorBack={rule.colorBack}
            type="classic"
            grid="square"
            size={1}
            radius={1.3}
            contrast={0.5}
            speed={0}
            minPixelRatio={1}
          />
        </div>

        {/* Asymmetric matte card cluster (ingredient c) */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] p-8 shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] md:col-span-5 dark:border-white/10 dark:bg-[#2b2830]">
            <h3 className="font-serif text-2xl tracking-tight">Currently</h3>
            <ul className="mt-6 space-y-4 text-sm leading-relaxed text-[#5d5673] dark:text-[#bdb6d0]">
              <li className="flex items-start gap-3">
                <Code2 {...ICON} className="mt-0.5 size-4 shrink-0" />
                Building an ask-me-anything portfolio on Next.js 15 + React 19
              </li>
              <li className="flex items-start gap-3">
                <GitBranch {...ICON} className="mt-0.5 size-4 shrink-0" />
                Shipping in small, reviewable commits — boring on purpose
              </li>
              <li className="flex items-start gap-3">
                <Sparkles {...ICON} className="mt-0.5 size-4 shrink-0" />
                Trading frosted glass for grain, dither, and matte paper
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-[#37304a]/10 bg-[#fffdf8] p-8 shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] md:col-span-4 md:translate-y-10 dark:border-white/10 dark:bg-[#2b2830]">
            <h3 className="font-serif text-2xl tracking-tight">Selected work</h3>
            <ul className="mt-6 space-y-4 text-sm text-[#5d5673] dark:text-[#bdb6d0]">
              <li className="flex items-center justify-between gap-3 border-b border-[#37304a]/10 pb-3 dark:border-white/10">
                Ask-Me portfolio
                <ArrowUpRight {...ICON} className="size-4 shrink-0" />
              </li>
              <li className="flex items-center justify-between gap-3 border-b border-[#37304a]/10 pb-3 dark:border-white/10">
                Cutout — palette extractor
                <ArrowUpRight {...ICON} className="size-4 shrink-0" />
              </li>
              <li className="flex items-center justify-between gap-3">
                This very page
                <ArrowUpRight {...ICON} className="size-4 shrink-0" />
              </li>
            </ul>
            <p className="mt-8 flex items-center gap-2 text-xs uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
              <Mail {...ICON} className="size-4" /> say hello via the ask-me box
            </p>
          </div>

          {/* Dithered portrait block (ingredient b, again) */}
          <figure className="overflow-hidden rounded-3xl border border-[#37304a]/10 bg-[#f4ecdf] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)] md:col-span-3 md:-translate-y-6 dark:border-white/10 dark:bg-[#26232c]">
            <div aria-hidden className="h-56 w-full">
              <ImageDithering
                style={{ width: '100%', height: '100%' }}
                image="/hero.png"
                colorFront={portrait.colorFront}
                colorBack={portrait.colorBack}
                colorHighlight={portrait.colorHighlight}
                type="8x8"
                size={2}
                colorSteps={3}
                speed={0}
                minPixelRatio={1}
              />
            </div>
            <figcaption className="px-5 py-4 font-mono text-[10px] uppercase tracking-widest text-[#6f6885] dark:text-[#a9a2bd]">
              hero.png · 8×8 ordered dither
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Candidate B — “Print Shop”: risograph / zine broadsheet             */
/* ------------------------------------------------------------------ */

function PrintShop({ reduced }: { reduced: boolean }) {
  const dark = useTheme().theme === 'dark';
  const band = dark ? PRINT_BAND.dark : PRINT_BAND.light;
  const press = dark ? PRINT_IMAGE.dark : PRINT_IMAGE.light;

  return (
    <section className="relative min-h-screen overflow-hidden text-[#221d12] dark:text-[#efe7d2]">
      <CandidateChip label="Candidate B — Print Shop" />

      {/* Near-paper flat backdrop; shader only as a partial band at the foot */}
      <div aria-hidden className="absolute inset-0 z-0 bg-[#f2ecdc] dark:bg-[#171410]">
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-r from-[#d6467e]/25 to-[#33639f]/25 dark:from-[#f09cc0]/15 dark:to-[#8fb4e0]/15">
          <GrainGradient
            style={SHADER_FILL}
            colorBack={band.colorBack}
            colors={band.colors}
            shape="dots"
            softness={0.15}
            intensity={0.55}
            noise={0.45}
            speed={reduced ? 0 : 0.25}
            minPixelRatio={1}
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-56 pt-28 md:px-10">
        {/* Masthead */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-y-2 border-[#221d12] py-3 font-mono text-[11px] uppercase tracking-[0.2em] dark:border-[#efe7d2]">
          <span className="flex items-center gap-2">
            <Newspaper {...ICON} className="size-4" /> Rijkaard Portfolio Press
          </span>
          <span>Vol. 35 · July 2026</span>
          <span className="flex items-center gap-2">
            <Printer {...ICON} className="size-4" /> Two-color riso
          </span>
        </div>

        {/* Numbered oversized headline (ingredient e) */}
        <div className="mt-10 flex flex-wrap items-start gap-x-8">
          <span className="text-[clamp(3.5rem,10vw,8rem)] font-black leading-[0.9] tracking-tight text-[#d6467e] dark:text-[#f09cc0]">
            01
          </span>
          <h2 className="text-[clamp(3.5rem,10vw,8rem)] font-black uppercase leading-[0.9] tracking-tight">
            Ink &amp;<br />systems
          </h2>
        </div>
        <p className="mt-6 max-w-xl font-mono text-sm uppercase tracking-widest text-[#5c5138] dark:text-[#b8ae93]">
          Noah Rijkaard · software engineer · prints ideas into production
        </p>

        {/* Broadsheet grid: hard 2px borders, matte paper cells */}
        <div className="mt-12 grid grid-cols-1 border-2 border-[#221d12] md:grid-cols-12 dark:border-[#efe7d2]">
          {/* Dithered press image (ingredient b) */}
          <figure className="border-b-2 border-[#221d12] bg-[#f2ecdc] md:col-span-5 md:border-b-0 md:border-r-2 dark:border-[#efe7d2] dark:bg-[#1c1813]">
            <div aria-hidden className="h-72 w-full md:h-96">
              <ImageDithering
                style={{ width: '100%', height: '100%' }}
                image="/cutout_project.jpeg"
                colorFront={press.colorFront}
                colorBack={press.colorBack}
                colorHighlight={press.colorHighlight}
                type="4x4"
                size={3}
                colorSteps={2}
                speed={0}
                minPixelRatio={1}
              />
            </div>
            <figcaption className="border-t-2 border-[#221d12] px-4 py-3 font-mono text-[10px] uppercase tracking-widest dark:border-[#efe7d2]">
              Fig. 1 — Cutout, palette extractor · 4×4 Bayer · 2 inks
            </figcaption>
          </figure>

          {/* Project ledger */}
          <div className="md:col-span-7">
            {[
              {
                no: '001',
                name: 'Ask-Me Portfolio',
                desc: 'LLM answers questions over a portfolio corpus, live on this site.',
              },
              {
                no: '002',
                name: 'Cutout',
                desc: 'Pulls palettes and clean cutouts from any uploaded image.',
              },
              {
                no: '003',
                name: 'Shader backdrop seam',
                desc: 'One steerable WebGL canvas; presets tween, types cross-fade.',
              },
            ].map((p) => (
              <article
                key={p.no}
                className="border-b-2 border-[#221d12] bg-[#faf6ea] px-6 py-5 dark:border-[#efe7d2] dark:bg-[#211d16]"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-xl font-black uppercase tracking-tight">
                    <span className="mr-3 font-mono text-sm font-bold text-[#33639f] dark:text-[#8fb4e0]">
                      {p.no}
                    </span>
                    {p.name}
                  </h3>
                  <ArrowUpRight {...ICON} className="size-4 shrink-0" />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#5c5138] dark:text-[#b8ae93]">
                  {p.desc}
                </p>
              </article>
            ))}

            {/* Colophon row with dotted badge */}
            <div className="flex items-center justify-between gap-4 bg-[#faf6ea] px-6 py-5 dark:bg-[#211d16]">
              <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]">
                <AtSign {...ICON} className="size-4" /> set in mono · no glass used
              </p>
              <div className="flex size-20 shrink-0 -rotate-12 items-center justify-center rounded-full border-2 border-dotted border-[#d6467e] text-center font-mono text-[9px] font-bold uppercase leading-tight text-[#d6467e] dark:border-[#f09cc0] dark:text-[#f09cc0]">
                Riso
                <br />
                proof
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Candidate C — “Night Matte Bento”: dense grid over dusk gradient    */
/* ------------------------------------------------------------------ */

const NIGHT_CARD =
  'rounded-2xl border border-[#2e2b38]/10 bg-[#f6f4f9] p-6 shadow-[0_10px_30px_-18px_rgba(20,19,25,0.5)] dark:border-white/10 dark:bg-[#211f29]';

function NightBento({ reduced }: { reduced: boolean }) {
  const dark = useTheme().theme === 'dark';
  const dusk = dark ? NIGHT_BENTO.dark : NIGHT_BENTO.light;
  const tile = dark ? NIGHT_TILE.dark : NIGHT_TILE.light;

  return (
    <section className="relative min-h-screen overflow-hidden text-[#2e2b38] dark:text-[#e9e6f2]">
      <CandidateChip label="Candidate C — Night Matte Bento" />

      {/* Full-bleed dusk gradient backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 z-0 bg-gradient-to-b from-[#dfe3ee] via-[#e6dcea] to-[#dce7e2] dark:from-[#17161d] dark:via-[#1b1723] dark:to-[#141a18]"
      >
        <GrainGradient
          style={SHADER_FILL}
          colorBack={dusk.colorBack}
          colors={dusk.colors}
          shape="sphere"
          softness={0.7}
          intensity={0.5}
          noise={0.3}
          speed={reduced ? 0 : 0.45}
          minPixelRatio={1}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-32 md:px-10">
        {/* Display type overlapping the grid edge (ingredient e) */}
        <h2 className="relative z-20 -mb-7 text-[clamp(3.5rem,8.5vw,8rem)] font-bold leading-[0.9] tracking-tight md:-mb-12">
          After hours,
          <br />
          <span className="text-[#5646a8] dark:text-[#9d8ff2]">still shipping.</span>
        </h2>

        <div className="grid auto-rows-[minmax(7rem,auto)] grid-cols-2 gap-3 md:grid-cols-4">
          {/* About — 2x2 */}
          <div className={`${NIGHT_CARD} col-span-2 row-span-2 flex flex-col justify-between pt-16 md:pt-20`}>
            <div>
              <p className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6580] dark:text-[#a29bbd]">
                <Terminal {...ICON} className="size-4" /> About
              </p>
              <p className="text-lg leading-relaxed">
                Noah Rijkaard builds backend services and the interfaces on top
                of them. Six-plus years across Ruby, TypeScript, and cloud
                infra — currently teaching a portfolio to answer questions
                about itself.
              </p>
            </div>
            <div className="mt-6 flex gap-8 font-mono text-xs text-[#6b6580] dark:text-[#a29bbd]">
              <span>30+ repos</span>
              <span>3 rewrites survived</span>
              <span>0 frosted panes</span>
            </div>
          </div>

          {/* Halftone accent tile (ingredient b) — 1x2 */}
          <figure className="col-span-1 row-span-2 overflow-hidden rounded-2xl border border-[#2e2b38]/10 bg-[#f6f4f9] shadow-[0_10px_30px_-18px_rgba(20,19,25,0.5)] dark:border-white/10 dark:bg-[#211f29]">
            <div aria-hidden className="relative h-full min-h-40 w-full">
              <HalftoneDots
                style={SHADER_FILL}
                image="/hero.png"
                colorFront={tile.colorFront}
                colorBack={tile.colorBack}
                type="classic"
                grid="hex"
                size={0.8}
                radius={1.35}
                contrast={0.55}
                speed={0}
                minPixelRatio={1}
              />
            </div>
          </figure>

          {/* Stack — 1x2 */}
          <div className={`${NIGHT_CARD} col-span-1 row-span-2`}>
            <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6580] dark:text-[#a29bbd]">
              <Layers {...ICON} className="size-4" /> Stack
            </p>
            <ul className="space-y-2 text-sm">
              <li>TypeScript</li>
              <li>React / Next.js</li>
              <li>Ruby on Rails</li>
              <li>PostgreSQL</li>
              <li>AWS</li>
              <li className="text-[#5646a8] dark:text-[#7fe0bd]">WebGL, newly</li>
            </ul>
          </div>

          {/* Project — 2x1 */}
          <div className={`${NIGHT_CARD} col-span-2 flex items-start justify-between gap-4`}>
            <div>
              <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6580] dark:text-[#a29bbd]">
                <Globe {...ICON} className="size-4" /> Featured
              </p>
              <h3 className="text-xl font-semibold tracking-tight">Ask-Me Portfolio</h3>
              <p className="mt-1 text-sm text-[#5a5470] dark:text-[#b3acce]">
                A portfolio that answers back — retrieval over project notes.
              </p>
            </div>
            <ArrowUpRight {...ICON} className="size-4 shrink-0" />
          </div>

          {/* Project — 1x1 */}
          <div className={`${NIGHT_CARD} col-span-1`}>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6580] dark:text-[#a29bbd]">
              <Code2 {...ICON} className="size-4" /> Side
            </p>
            <h3 className="text-base font-semibold tracking-tight">Cutout</h3>
            <p className="mt-1 text-xs text-[#5a5470] dark:text-[#b3acce]">
              Palettes from pixels.
            </p>
          </div>

          {/* Contact — 1x1 */}
          <div className={`${NIGHT_CARD} col-span-1`}>
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#6b6580] dark:text-[#a29bbd]">
              <Mail {...ICON} className="size-4" /> Contact
            </p>
            <p className="text-sm">
              Open to interesting problems. Ping via the ask-me box.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AestheticPrototypePage() {
  const reduced = usePrefersReducedMotion();

  return (
    <main>
      {/* Intro strip */}
      <header className="bg-[#f2f0eb] px-6 pb-12 pt-24 text-[#33303a] md:px-10 dark:bg-[#141317] dark:text-[#dcd9e2]">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#7a7583] dark:text-[#8f8a9c]">
            Aesthetic prototype · ticket #35 · throwaway
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Pastel / matte / dither — three candidates
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5f5a6b] dark:text-[#a49fb2]">
            Candidate looks for the art direction replacing frosted glass.
            Scroll to compare; each section works in light and dark — toggle
            the theme with the switch in the header (top right). The winner
            gets picked in #36.
          </p>
        </div>
      </header>

      <SoftField reduced={reduced} />
      <PrintShop reduced={reduced} />
      <NightBento reduced={reduced} />
    </main>
  );
}
