'use client';

import { Component, type ReactNode } from 'react';
import Image from 'next/image';
import { TypeAnimation } from 'react-type-animation';
import { ImageDithering } from '@paper-design/shaders-react';
import SpotifyReveal from './ui/spotify-reveal';
import ChatBox from './ChatBox';
import { useTheme } from './ThemeProvider';

// Soft Field portrait palette (design-contract v2 §4.1) — violet-ink duotone
// dither that reads well on pastel in BOTH light and dark. The raw hero PNG
// was disconcerting on the light Soft Field backdrop (#41 user feedback).
const PORTRAIT_LIGHT = { colorFront: '#7a5fa0', colorBack: '#f4ecdf', colorHighlight: '#f3d9c8' };
const PORTRAIT_DARK = { colorFront: '#c9b3ec', colorBack: '#26232c', colorHighlight: '#8d7bb0' };

class DitherBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function HeroPortrait() {
  const { theme } = useTheme();
  const p = theme === 'dark' ? PORTRAIT_DARK : PORTRAIT_LIGHT;
  return (
    <div className="relative w-48 h-48 mb-8 rounded-full overflow-hidden border-4 border-[#fffdf8] dark:border-[#2b2830] shadow-[0_16px_40px_-24px_rgba(58,51,69,0.35)]">
      {/* CSS-duotone fallback: shown pre-hydration + if WebGL2 is unavailable */}
      <Image
        src="/hero.png"
        alt="Noah Rijkaard"
        fill
        sizes="(max-width: 768px) 100vw, 192px"
        priority
        className="object-cover [filter:sepia(0.5)_hue-rotate(240deg)_saturate(1.4)_contrast(1.1)_brightness(0.95)] dark:[filter:sepia(0.6)_hue-rotate(220deg)_saturate(1.8)_contrast(1.2)_brightness(0.7)]"
      />
      {/* 8×8 ordered dither duotone (§4.1) — sits above the fallback, same shape */}
      <DitherBoundary fallback={null}>
        <ImageDithering
          image="/hero.png"
          colorFront={p.colorFront}
          colorBack={p.colorBack}
          colorHighlight={p.colorHighlight}
          type="8x8"
          size={2}
          colorSteps={3}
          speed={0}
          minPixelRatio={1}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      </DitherBoundary>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen">

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <HeroPortrait />
        <h1 className="text-4xl font-bold mb-4 text-white">Noah Rijkaard</h1>
        <div className="w-full max-w-md">
          <TypeAnimation
            sequence={[
              "Full Stack Developer 🚀",
              3000,
              "Docker Enthusiast 🐳",
              3000,
              "Problem Solver 🧩",
              2000,
              "Self Hosted for lifer 🏠",
              4000,
              "JavaScript Ninja 🥷",
              3000,
              "CSS Wizard 🧙",
              2000,
              "React Pro ⚛️",
              2000,
              "Node.js Guru 🧙",
              2000,
              "API Architect 🏗️",
              2000,
              "Database Tamer 🐘",
              2000,
              "Bug Squasher 🐛",
              2000,
              "Code Reviewer 🕵️",
              2000,
              "Open Source Contributor 🌟",
              3000,
              "Agile Advocate 🏃",
              2000,
              "Tech Blogger 📝",
              2000,
              "Cloud Explorer ☁️",
              2000,
              "DevOps Enthusiast 🚀",
              2000,
              "Performance Optimizer 🚀",
              2000,
              "Security Buff 🛡️",
              2000,
              "Riding the Ruby Rail 🚂",
              4000,
              "Pythonista☕",
              2000,
            ]}
            wrapper="h2"
            cursor={true}
            repeat={Infinity}
            className="text-2xl text-gray-300"
          />
        </div>
          <SpotifyReveal />
          <ChatBox />
      </div>
    </section>
  );
}
