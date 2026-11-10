import type { Metadata } from 'next';
import Link from 'next/link';
import { Instrument_Serif, JetBrains_Mono } from 'next/font/google';

import Studies from '@/components/studies/Studies';

import './studies.css';

const display = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-st-display' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-st-mono' });

export const metadata: Metadata = {
  title: 'Studies | Noah Rijkaard',
  description: 'Seven quiet, interactive generative pieces: fluid ink, a lattice and an ASCII tide that form a portrait, contours, a printed vase, a morphing point cloud and silk.',
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
