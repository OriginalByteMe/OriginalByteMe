"use client";
import { useMemo } from "react";
import {
  StateProvider,
  ActionProvider,
  VisibilityProvider,
  createStateStore,
} from "@json-render/react";

// `initialState` is the serializable output of corpusState() (JSON-pointer keys),
// computed in a SERVER component and passed down. Never import @/lib/corpus here:
// "use client" would drag the node:fs corpus loader into the client bundle.
export function JsonUiProvider({
  initialState,
  children,
}: {
  initialState: Record<string, unknown>;
  children: React.ReactNode;
}) {
  const store = useMemo(
    () => createStateStore(buildInitialState(initialState)),
    [initialState],
  );
  return (
    <StateProvider store={store}>
      <ActionProvider>
        <VisibilityProvider>{children}</VisibilityProvider>
      </ActionProvider>
    </StateProvider>
  );
}

// createStateStore takes a plain nested object; corpusState() returns
// JSON-pointer keys ("/corpus/projects" -> value). Nest them under `corpus`
// so useStateValue("/corpus/projects") resolves.
function buildInitialState(flat: Record<string, unknown>) {
  const corpus: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    corpus[key.replace("/corpus/", "")] = value;
  }
  return { corpus };
}
