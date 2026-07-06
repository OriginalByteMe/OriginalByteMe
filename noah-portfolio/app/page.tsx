import Hero from "@/components/Hero";
import Backdrop from "@/components/Backdrop";
import PortfolioCanvas from "@/components/PortfolioCanvas";
import { AskMeProvider } from "@/components/AskMeProvider";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Backdrop />
      <div className="relative z-10">
        <AskMeProvider>
          <Hero />
          <PortfolioCanvas />
        </AskMeProvider>
      </div>
    </main>
  );
}
