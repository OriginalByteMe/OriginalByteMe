import type { Metadata } from 'next';
import Link from 'next/link';
import { Instrument_Serif, JetBrains_Mono } from 'next/font/google';

import Studies from '@/components/studies/Studies';

import './studies.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-st-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-st-mono' });

export const metadata: Metadata = {
  title: 'Studies | Noah Rijkaard',
  description: 'Nine quiet, interactive generative pieces: a morphing point cloud, a black hole, fluid ink, silk, contours, a printed vase, a pulsar, a lattice and an ASCII tide.',
};

export default function StudiesPage() {
  return (
    <main className={`${display.variable} ${mono.variable}`}>
      <Link href="/" className="st-back">
        Noah Rijkaard
      </Link>
      <Studies />
    </main>
  );
}
