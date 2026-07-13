import Hero from "@/components/Hero";
import Backdrop from "@/components/Backdrop";
import BackdropSceneSync from "@/components/BackdropSceneSync";
import PortfolioCanvas from "@/components/PortfolioCanvas";
import { AskMeProvider } from "@/components/AskMeProvider";
import { normalizePortfolioQuery } from "@/lib/portfolio-query";

interface HomeProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { q } = await searchParams;
  const initialQuery = normalizePortfolioQuery(q);
  return (
    <main className="relative min-h-screen overflow-hidden">
      <Backdrop />
      <div className="relative z-10">
        <AskMeProvider initialQuery={initialQuery}>
          <BackdropSceneSync />
          <Hero />
          <div id="story"><PortfolioCanvas /></div>
        </AskMeProvider>
      </div>
    </main>
  );
}
