'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { setBackdropPreset, resetBackdropPreset } from '@/lib/store/slices/backdrop-slice';
import type { BackdropPresetName } from '@/lib/backdrop/presets';
import { useAskMe } from './AskMeProvider';

/**
 * Steers the single Backdrop through the preset allowlist as the visitor
 * scrolls the home story — each chapter gets its own shader family, so the
 * background is a moving tour of the paper-shaders catalog (grain gradient →
 * color panels → mesh gradient → metaballs → dithering → grain sphere).
 *
 * Only active in home mode: generated answers pick their own preset via the
 * spec's "/backdrop/preset" state (usePortfolioCanvas applies it), and this
 * observer must not fight that choice.
 */
const SCENE_PRESETS: Record<string, BackdropPresetName> = {
  intro: 'softField',
  stack: 'panelParade',
  career: 'meshBloom',
  builds: 'metaOrbs',
  setup: 'ditherTide',
  contact: 'nightMatte',
};

export default function BackdropSceneSync() {
  const { mode } = useAskMe();
  const dispatch = useDispatch();

  useEffect(() => {
    if (mode !== 'home') return;
    if (typeof IntersectionObserver === 'undefined') return;

    let observer: IntersectionObserver | null = null;
    // Bind after the home<->answer cross-fade (350ms) settles so we observe
    // the live sections, not exiting AnimatePresence clones with the same ids.
    const bindTimer = window.setTimeout(() => {
      observer = new IntersectionObserver(
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
      for (const id of Object.keys(SCENE_PRESETS)) {
        const section = document.getElementById(id);
        if (section) observer.observe(section);
      }
    }, 450);

    return () => {
      window.clearTimeout(bindTimer);
      observer?.disconnect();
      dispatch(resetBackdropPreset());
    };
  }, [mode, dispatch]);

  return null;
}
