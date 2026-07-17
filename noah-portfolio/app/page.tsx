import Backdrop from "@/components/Backdrop";
import { JsonUiProvider } from "@/components/JsonUiProvider";
import BackdropSceneSync from "@/components/BackdropSceneSync";
import SiteShell from "@/components/SiteShell";
import { AskMeProvider } from "@/components/AskMeProvider";
import { corpusState } from "@/lib/corpus";

export default function Home() {
  return (
    <JsonUiProvider initialState={corpusState()}>
      <main className="relative min-h-screen overflow-x-clip">
        <Backdrop />
        <div className="relative z-10">
          <AskMeProvider>
            <BackdropSceneSync />
            <SiteShell />
          </AskMeProvider>
        </div>
      </main>
    </JsonUiProvider>
  );
}
