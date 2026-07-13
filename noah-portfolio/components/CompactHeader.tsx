'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useAskMe } from './AskMeProvider';

/**
 * Answer-mode masthead: while a generated answer owns the page, the hero
 * collapses into this fixed bar — the dithered portrait as a small icon plus
 * the name. Clicking it rebuilds the home story live (goHome streams the
 * home spec patch-by-patch).
 */
export default function CompactHeader() {
  const { goHome, question } = useAskMe();

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -64, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      className="fixed inset-x-0 top-0 z-40 border-b border-[#37304a]/10 bg-[#f7f2e7]/95 text-[#37304a] dark:border-white/10 dark:bg-[#1a1721]/95 dark:text-[#eae6f2]"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={goHome}
          aria-label="Back to the main site"
          title="Back to the main site"
          className="group flex min-h-11 items-center gap-3 rounded-full pr-3 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fa0]/40"
        >
          <span className="relative size-11 shrink-0 overflow-hidden rounded-2xl border border-[#37304a]/10 bg-[#f4ecdf] transition-transform group-hover:scale-105 dark:border-white/10 dark:bg-[#26232c]">
            <Image
              src="/hero.png"
              alt="Noah's portrait"
              fill
              sizes="44px"
              className="object-cover [filter:sepia(0.48)_hue-rotate(240deg)_saturate(1.34)_contrast(1.08)] dark:[filter:sepia(0.62)_hue-rotate(220deg)_saturate(1.65)_contrast(1.12)_brightness(0.78)]"
            />
          </span>
          <span className="flex flex-col text-left">
            <span className="font-serif text-lg leading-tight tracking-tight">
              Noah <em className="italic text-[#5646a8] dark:text-[#9d8ff2]">Rijkaard</em>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#6f6885] dark:text-[#a9a2bd]">
              Tap to rebuild the site
            </span>
          </span>
        </button>
        {question ? (
          <span className="ml-auto hidden max-w-[40%] truncate font-mono text-xs text-[#6f6885] sm:block dark:text-[#a9a2bd]">
            &ldquo;{question}&rdquo;
          </span>
        ) : null}
      </div>
    </motion.header>
  );
}
