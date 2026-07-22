"use client";
import * as React from "react";
import {
  StateProvider,
  ActionProvider,
  VisibilityProvider,
  createStateStore,
} from "@json-render/react";
import { Provider as ReduxProvider } from "react-redux";
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import spotifySlice from "@/lib/store/slices/spotify-slice";
import corpus from "./corpus.json";

// Minimal redux store: SpotifyNowPlaying only reads the `spotify` slice, so we
// avoid pulling the app's backdrop/theme shader slices into the preview bundle.
const store = configureStore({
  reducer: combineReducers({ spotify: spotifySlice }),
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
});

// design-sync preview provider.
//
// The json-render catalog components read Noah's portfolio corpus through
// `useStateValue("/corpus/...")`, exactly as JsonUiProvider wires it in the
// app (StateProvider → ActionProvider → VisibilityProvider). `corpus.json` is
// the real corpus baked from content/about-me at sync time, nested under
// `corpus` so `useStateValue("/corpus/projects")` resolves.
//
// SpotifyNowPlaying additionally reads a redux slice, so the app's real store
// is provided too — the reveal renders its closed pill without fetching.
const stateStore = createStateStore(corpus as Record<string, unknown>);

export function DesignPreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReduxProvider store={store}>
      <StateProvider store={stateStore}>
        <ActionProvider>
          <VisibilityProvider>{children}</VisibilityProvider>
        </ActionProvider>
      </StateProvider>
    </ReduxProvider>
  );
}
