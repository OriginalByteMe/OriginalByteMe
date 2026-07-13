'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Hero from './Hero';
import PortfolioCanvas from './PortfolioCanvas';
import CompactHeader from './CompactHeader';
import AskDock from './AskDock';
import { useAskMe } from './AskMeProvider';

/**
 * Mode-aware page chrome. Home mode shows the full hero; the moment a
 * generation starts (streaming/answer) the whole hero yields to the compact
 * masthead so the streamed spec IS the site. The AskDock floats over both.
 */
export default function SiteShell() {
  const { mode } = useAskMe();
  const takeover = mode !== 'home';

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {takeover ? (
          <CompactHeader key="masthead" />
        ) : (
          <motion.div
            key="hero"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.3 }}
          >
            <Hero />
          </motion.div>
        )}
      </AnimatePresence>
      <div id="story" className={takeover ? 'pt-16' : undefined}>
        <PortfolioCanvas />
      </div>
      <AskDock />
    </>
  );
}
