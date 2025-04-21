"use client";

import Image from "next/image";
import { TypeAnimation } from "react-type-animation";
import SpotifyReveal from "./ui/spotify-reveal";

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* Lava Lamp Background */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute inset-0 bg-gradient-to-br from-gradient-start to-gradient-end opacity-80" />

        <div className="absolute inset-0">
          <div
            className="absolute w-96 h-96 bg-blob-primary rounded-full blur-xl opacity-60
            animate-[blob1_55s_infinite] left-0 top-0"
          />
          <div
            className="absolute w-[30rem] h-[30rem] bg-blob-secondary rounded-full blur-xl opacity-60
            animate-[blob2_48s_infinite] right-0 bottom-1/4"
          />
          <div
            className="absolute w-[28rem] h-[28rem] bg-blob-tertiary rounded-full blur-xl opacity-50
            animate-[blob3_39s_infinite] left-1/4 bottom-0"
          />
          <div
            className="absolute w-[34rem] h-[34rem] bg-blob-primary rounded-full blur-xl opacity-40
            animate-[blob4_42s_infinite] right-1/4 top-1/4"
          />
          <div
            className="absolute w-[26rem] h-[26rem] bg-blob-secondary rounded-full blur-xl opacity-50
            animate-[blob5_87s_infinite] left-1/3 top-1/3"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative w-48 h-48 mb-8 rounded-full overflow-hidden border-4 border-white">
          <Image
            src="/hero.png"
            alt="Developer"
            fill
            sizes="(max-width: 768px) 100vw, 192px"
            priority
            className="object-cover"
          />
        </div>
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
      </div>
    </section>
  );
}
