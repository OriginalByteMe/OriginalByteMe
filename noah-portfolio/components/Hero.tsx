'use client'

import Image from 'next/image'
import { TypeAnimation } from 'react-type-animation'

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="relative w-48 h-48 mb-8 rounded-full overflow-hidden border-4 border-white">
        <Image
          src="/hero.png"
          alt="Noah Rijkaard"
          width={200}
          height={200}
          objectFit="cover"
        />
      </div>
      <h1 className="text-4xl font-bold mb-4">Noah Rijkaard</h1>
      <TypeAnimation
        sequence={[
          'Full Stack Developer',
          2000,
          'Software Engineer',
          2000,
          'Problem Solver',
          2000,
        ]}
        wrapper="h2"
        cursor={true}
        repeat={Infinity}
        className="text-2xl text-gray-300"
      />
    </section>
  )
}

