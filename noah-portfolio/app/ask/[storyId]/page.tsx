import { notFound } from "next/navigation";
import Backdrop from "@/components/Backdrop";
import BackdropSceneSync from "@/components/BackdropSceneSync";
import { AskMeProvider } from "@/components/AskMeProvider";
import SiteShell from "@/components/SiteShell";
import { resolveStory } from "@/lib/story/store";
import { toPublicStory } from "@/lib/story/types";
import OutdatedStory from "./OutdatedStory";

interface StoryPageProps {
  params: Promise<{ storyId: string }>;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { storyId } = await params;
  const resolution = await resolveStory(storyId);

  if (resolution.status === "missing") {
    notFound();
  }

  if (resolution.status === "outdated") {
    return (
      <main className="relative min-h-screen overflow-x-clip">
        <Backdrop />
        <div className="relative z-10">
          <OutdatedStory displayQuestion={resolution.displayQuestion} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-clip">
      <Backdrop />
      <div className="relative z-10">
        <AskMeProvider initialStory={toPublicStory(resolution.story)}>
          <BackdropSceneSync />
          <SiteShell />
        </AskMeProvider>
      </div>
    </main>
  );
}
