'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { setBackdropPreset, resetBackdropPreset } from '@/lib/store/slices/backdrop-slice';
import type { BackdropPresetName } from '@/lib/backdrop/presets';
import { useAskMe } from './AskMeProvider';

/**
 * Steers the single Backdrop through the "dither flow" series as the visitor
 * scrolls the home story. Every chapter preset shares ONE wave-dither
 * geometry, so each hand-off is a smooth color tween on the same canvas —
 * a continuously moving background whose ink hue drifts with the story,
 * starting at the hero itself.
 *
 * Only active in home mode: generated answers pick their own preset via the
 * spec's "/backdrop/preset" state (usePortfolioCanvas applies it), and this
 * observer must not fight that choice.
 */
const SCENE_PRESETS: Record<string, BackdropPresetName> = {
  hero: 'ditherViolet',
  intro: 'ditherViolet',
  stack: 'ditherSky',
  career: 'ditherEmber',
  builds: 'ditherMint',
  setup: 'ditherRose',
  contact: 'ditherIndigo',
};

export default function BackdropSceneSync() {
  const { mode } = useAskMe();
  const dispatch = useDispatch();

  useEffect(() => {
    if (mode !== 'home') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const presetName = SCENE_PRESETS[visible.target.id];
        if (presetName) dispatch(setBackdropPreset(presetName));
      },
      // Fires as a chapter fills the middle of the viewport.
      { threshold: 0.4 },
    );

    // Bind after the home<->answer cross-fade (350ms) settles so we observe
    // the live sections, not exiting AnimatePresence clones with the same ids.
    // The home spec can also stream in progressively (the "rebuild" return
    // path), so keep retrying until every chapter section exists.
    const bound = new Set<string>();
    let retryTimer: number | undefined;
    let attempts = 0;
    const bind = () => {
      for (const id of Object.keys(SCENE_PRESETS)) {
        if (bound.has(id)) continue;
        const section = document.getElementById(id);
        if (section) {
          observer.observe(section);
          bound.add(id);
        }
      }
      attempts += 1;
      if (bound.size < Object.keys(SCENE_PRESETS).length && attempts < 12) {
        retryTimer = window.setTimeout(bind, 500);
      }
    };
    const bindTimer = window.setTimeout(bind, 450);

    return () => {
      window.clearTimeout(bindTimer);
      window.clearTimeout(retryTimer);
      observer.disconnect();
      dispatch(resetBackdropPreset());
    };
  }, [mode, dispatch]);

  return null;
}
