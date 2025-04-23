import Hero from "@/components/Hero";
import About from "@/components/About";
import Projects from "@/components/Projects";
import Contact from '@/components/Contact'
import LavaLampBackground from "@/components/LavaLampBackground";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <LavaLampBackground />
      <div className="relative z-10">
        <Hero />
        <About />
        <Projects />
        <Contact />
      </div>
    </main>
  )
}

