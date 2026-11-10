import type { Metadata } from 'next';
import Link from 'next/link';
import { Inter, JetBrains_Mono, Unbounded } from 'next/font/google';

import CosmosJourney from '@/components/cosmos/CosmosJourney';
import CosmosWorkbench from '@/components/cosmos/CosmosWorkbench';
import { PALETTES, SCENES, STYLES, TRANSITIONS } from '@/lib/cosmos/config';

import './cosmos.css';

const display = Unbounded({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-cosmos-display' });
const text = Inter({ subsets: ['latin'], variable: '--font-cosmos-text' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-cosmos-mono' });

export const metadata: Metadata = {
  title: 'Cosmos Lab | Noah Rijkaard',
  description: `${SCENES.length} interactive scenes, ${STYLES.length} render styles and ${TRANSITIONS.length} scroll transitions telling Noah's story in space.`,
};

export default function CosmosPage() {
  return (
    <main className={`cz-page ${display.variable} ${text.variable} ${mono.variable}`}>
      <header className="cz-topbar">
        <Link href="/">Noah Rijkaard</Link>
        <nav aria-label="Cosmos lab">
          <a href="#workbench">Workbench</a>
        </nav>
      </header>

      <CosmosJourney />

      <section className="cz-section" id="workbench" aria-labelledby="workbench-heading">
        <div className="cz-section-inner">
          <div className="cz-section-head">
            <h2 className="cz-h2" id="workbench-heading">
              Pick what stays
            </h2>
            <p className="cz-lede">
              {SCENES.length} scenes, {STYLES.length} render styles and {PALETTES.length} palettes, all
              interchangeable. The preview is live: move over it, click it, and play any of the{' '}
              {TRANSITIONS.length} transitions into the next scene.
            </p>
          </div>
          <CosmosWorkbench />
          <p className="cz-foot">
            Everything here is one dependency-free WebGL2 engine in <code>lib/cosmos</code>. Use{' '}
            <code>&lt;CosmosCanvas /&gt;</code> for a single scene or <code>&lt;CosmosJourney /&gt;</code>{' '}
            for the scroll story.
          </p>
        </div>
      </section>
    </main>
  );
}
