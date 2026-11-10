'use client';

import { useEffect, useRef } from 'react';

import { useTheme } from '@/components/ThemeProvider';
import { SITE_PALETTES, STUDIES, mountStudy, type Mounted, type StudyOptions } from '@/lib/studies';

interface Plan {
  /** The home Scene this piece sits behind (its section id). */
  id: string;
  study: string;
  variant: number;
  opts?: (dark: boolean) => StudyOptions;
}

/** Which piece plays behind which chapter of the home story. */
const PLAN: Plan[] = [
  { id: 'intro', study: 'ink', variant: 0 },
  { id: 'stack', study: 'contours', variant: 0 },
  {
    id: 'career',
    study: 'tide',
    variant: 3,
    // The ark logo, rising out of a sheet of characters.
    opts: (dark) => ({ image: { src: '/Noah Icon FA.svg', invert: dark }, fit: 'contain', imageScale: 0.78, density: 1.25 }),
  },
  { id: 'builds', study: 'vase', variant: 0 },
  { id: 'setup', study: 'lattice', variant: 2 },
  { id: 'contact', study: 'forms', variant: 0 },
];

/**
 * The home page's moving ground. Every chapter gets one piece on a canvas
 * pinned to the viewport and clipped to that chapter's on-screen box, so the
 * boundary between two chapters is also the wipe between two animations.
 * Only chapters near the viewport hold a live canvas.
 */
export default function HomeStudies() {
  const { theme } = useTheme();
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = layer.current;
    if (!root) return;
    const dark = theme === 'dark';
    const pal = dark ? SITE_PALETTES.dark : SITE_PALETTES.light;
    const slots = PLAN.map((plan) => {
      const el = document.createElement('div');
      el.className = 'home-study';
      el.hidden = true;
      root.append(el);
      return { plan, el, mounted: null as Mounted | null, canvas: null as HTMLCanvasElement | null, failed: false };
    });

    const update = () => {
      const vh = window.innerHeight;
      const takeover = document.querySelector<HTMLElement>('.site-shell')?.dataset.takeover === 'true';
      const rects = slots.map((slot) => {
        const section = takeover ? null : document.getElementById(slot.plan.id);
        return section?.closest('#story') ? section.getBoundingClientRect() : null;
      });
      for (const [i, slot] of slots.entries()) {
        const rect = rects[i];
        const near = rect !== null && rect.bottom > -vh * 0.4 && rect.top < vh * 1.4;
        if (!near || slot.failed) {
          slot.mounted?.destroy();
          slot.mounted = null;
          slot.canvas?.remove();
          slot.canvas = null;
          slot.el.hidden = true;
          continue;
        }
        if (!slot.canvas) {
          const study = STUDIES.find((s) => s.id === slot.plan.study);
          const canvas = document.createElement('canvas');
          slot.el.append(canvas);
          slot.canvas = canvas;
          slot.mounted = study ? mountStudy(canvas, study, pal, slot.plan.variant, slot.plan.opts?.(dark)) : null;
          slot.failed = !slot.mounted;
          if (slot.failed) continue;
        }
        const top = Math.max(0, rect.top);
        // Run to the top of the next chapter so no gap opens between two pieces.
        const end = rects[i + 1]?.top ?? rect.bottom;
        const bottom = Math.max(0, vh - end);
        slot.el.hidden = top >= vh || bottom >= vh;
        slot.el.style.clipPath = `inset(${top}px 0 ${bottom}px 0)`;
        // A little parallax, so neighbouring pieces slide past each other rather than just cut.
        const drift = Math.max(-1, Math.min(1, ((rect.top + rect.bottom) / 2 - vh / 2) / vh));
        slot.canvas.style.transform = `translate3d(0, ${(drift * vh * 0.05).toFixed(1)}px, 0)`;
      }
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        update();
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // The story re-renders (and Ask-Me takes over the page), so re-measure on a slow beat too.
    const beat = window.setInterval(update, 600);
    update();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.clearInterval(beat);
      slots.forEach((s) => {
        s.mounted?.destroy();
        s.el.remove();
      });
    };
  }, [theme]);

  return <div ref={layer} aria-hidden="true" className="home-studies" data-testid="home-studies" />;
}
