'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import Hero from './Hero';
import PortfolioCanvas from './PortfolioCanvas';
import CompactHeader from './CompactHeader';
import AskDock from './AskDock';
import { ThemeSwitch } from './ThemeSwitch';
import SpotifyReveal from './ui/spotify-reveal';
import { useAskMe } from './AskMeProvider';

const TOP_CHROME_ACTION_CLASS = 'hero-action min-h-11 rounded-full px-4 text-sm font-medium';

export const LISTENING_EASTER_EGG_SLOTS = [
  'hero-edge-left',
  'hero-edge-right',
  'chapter-1-left',
  'chapter-2-right',
  'chapter-4-left',
  'chapter-5-right',
] as const;
export type ListeningEasterEggSlot = (typeof LISTENING_EASTER_EGG_SLOTS)[number];

const LISTENING_SLOT_STORAGE_KEY = 'listeningEasterEggSlot';
const LISTENING_SLOT_CONFIG: Record<
  ListeningEasterEggSlot,
  { align: 'left' | 'right'; sectionIndex: number | null }
> = {
  'hero-edge-left': { align: 'left', sectionIndex: null },
  'hero-edge-right': { align: 'right', sectionIndex: null },
  'chapter-1-left': { align: 'left', sectionIndex: 0 },
  'chapter-2-right': { align: 'right', sectionIndex: 1 },
  'chapter-4-left': { align: 'left', sectionIndex: 3 },
  'chapter-5-right': { align: 'right', sectionIndex: 4 },
};

export function chooseListeningEasterEggSlot(random = Math.random): ListeningEasterEggSlot {
  const index = Math.min(
    LISTENING_EASTER_EGG_SLOTS.length - 1,
    Math.max(0, Math.floor(random() * LISTENING_EASTER_EGG_SLOTS.length)),
  );
  return LISTENING_EASTER_EGG_SLOTS[index];
}

function ListeningEasterEgg() {
  const [slot, setSlot] = useState<ListeningEasterEggSlot | null>(null);
  const [sectionHost, setSectionHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let selected: ListeningEasterEggSlot | null = null;
    try {
      const stored = window.sessionStorage.getItem(LISTENING_SLOT_STORAGE_KEY);
      if (LISTENING_EASTER_EGG_SLOTS.includes(stored as ListeningEasterEggSlot)) {
        selected = stored as ListeningEasterEggSlot;
      }
    } catch {
      /* Session storage can be unavailable in privacy modes. */
    }

    if (!selected) {
      selected = chooseListeningEasterEggSlot();
      try {
        window.sessionStorage.setItem(LISTENING_SLOT_STORAGE_KEY, selected);
      } catch {
        /* The chosen slot still remains stable for this mounted session. */
      }
    }
    setSlot(selected);
  }, []);

  useEffect(() => {
    if (!slot) return;
    const { sectionIndex } = LISTENING_SLOT_CONFIG[slot];
    if (sectionIndex === null) {
      setSectionHost(null);
      return;
    }

    const story = document.getElementById('story');
    if (!story) return;

    const host = document.createElement('div');
    host.className = 'site-listening-section-anchor';
    host.dataset.listeningSection = String(sectionIndex + 1);

    const attachHost = () => {
      const section = story.querySelectorAll<HTMLElement>('section')[sectionIndex];
      if (section && host.parentElement !== section) {
        section.appendChild(host);
      }
    };

    attachHost();
    setSectionHost(host);
    const observer = new MutationObserver(attachHost);
    observer.observe(story, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      host.remove();
    };
  }, [slot]);

  const layer = (
    <div className="listening-easter-egg-layer">
      {slot && (
        <aside
          aria-label="Listening easter egg"
          className="listening-easter-egg"
          data-align={LISTENING_SLOT_CONFIG[slot].align}
          data-slot={slot}
          data-testid="listening-easter-egg"
        >
          <SpotifyReveal variant="easter-egg" />
        </aside>
      )}
    </div>
  );

  if (slot && LISTENING_SLOT_CONFIG[slot].sectionIndex !== null && !sectionHost) return null;
  return sectionHost ? createPortal(layer, sectionHost) : layer;
}

/**
 * Mode-aware page chrome. Home mode shows the full hero; the moment a
 * generation starts (streaming/answer) the whole hero yields to the compact
 * masthead so the streamed spec IS the site. The AskDock floats over both.
 */
export default function SiteShell() {
  const { mode } = useAskMe();
  const reducedMotion = Boolean(useReducedMotion());
  const takeover = mode !== 'home';

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="site-shell"
        data-reduced-motion={reducedMotion ? 'true' : 'false'}
        data-takeover={takeover}
      >
        <div className="site-top-chrome">
          <nav className="site-primary-nav" aria-label="Primary navigation">
            <a
              className={TOP_CHROME_ACTION_CLASS}
              href="#story"
              aria-label="Read Noah's story"
            >
              Story <ArrowDown strokeWidth={1.5} className="size-4" aria-hidden />
            </a>
            <a
              className={TOP_CHROME_ACTION_CLASS}
              href="https://blog.noahrijkaard.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Read Noah's blog"
            >
              Blog <ArrowUpRight strokeWidth={1.5} className="size-4" aria-hidden />
            </a>
          </nav>
          <div className="site-theme-toggle">
            <ThemeSwitch />
          </div>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {takeover ? (
            <CompactHeader key="masthead" />
          ) : (
            <motion.div
              key="hero"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -24 }}
              transition={{ duration: reducedMotion ? 0 : 0.3 }}
            >
              <Hero />
            </motion.div>
          )}
        </AnimatePresence>
        {mode === 'home' ? <ListeningEasterEgg /> : null}
        <div id="story" className={takeover ? 'pt-16' : undefined}>
          <PortfolioCanvas />
        </div>
        <AskDock />
      </div>
    </MotionConfig>
  );
}
