'use client'

import Image from 'next/image'
import { TypeAnimation } from 'react-type-animation'

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-black text-black dark:text-white">
      <div className="relative w-48 h-48 mb-8 rounded-full overflow-hidden border-4 border-white">
        <Image
          src="/hero.png"
          alt="Developer"
          layout="fill"
          objectFit="cover"
        />
      </div>
      <h1 className="text-4xl font-bold mb-4">Noah Rijkaard</h1>
      <TypeAnimation
        sequence={[
          "Full Stack Developer",
          2000,
          "Docker Enthusiast",
          2000,
          "Problem Solver",
          2000,
          "Self Hosted for lifer",
          2000,
          "JavaScript Ninja",
          2000,
          "CSS Wizard",
          2000,
          "React Pro",
          2000,
          "Node.js Guru",
          2000,
          "API Architect",
          2000,
          "Database Tamer",
          2000,
          "Bug Squasher",
          2000,
          "Code Reviewer",
          2000,
          "Open Source Contributor",
          2000,
          "Agile Advocate",
          2000,
          "Tech Blogger",
          2000,
          "Cloud Explorer",
          2000,
          "DevOps Enthusiast",
          2000,
          "Performance Optimizer",
          2000,
          "Security Buff",
          2000,
        ]}
        wrapper="h2"
        cursor={true}
        repeat={Infinity}
        className="text-2xl text-gray-700 dark:text-gray-300"
      />
    </section>
  );
}

