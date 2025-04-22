import { combineReducers, configureStore } from "@reduxjs/toolkit";

import spotifySlice from "@/lib/store/slices/spotify-slice";

// State type
export type RootState = ReturnType<typeof combinedReducer>;

export const combinedReducer = combineReducers({ spotify: spotifySlice });

// Create store with optional preloaded state
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: combinedReducer,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false }),
    preloadedState,
  });
}

// Use setupStore for actual store instance
export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
