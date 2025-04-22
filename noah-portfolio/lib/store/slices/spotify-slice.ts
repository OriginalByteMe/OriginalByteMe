import { createSlice, PayloadAction, configureStore } from '@reduxjs/toolkit';
import { ISpotifyState, SpotifyTrack } from '@/app/utils/interfaces';

const initialState: ISpotifyState = {
  tracks: [],
  isLoading: false,
  error: null,
  selectedTrack: null
};

const spotifySlice = createSlice({
  name: 'spotify',
  initialState,
  reducers: {
    setTracks: (state, action: PayloadAction<SpotifyTrack[]>) => {
      state.tracks = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setSelectedTrack: (state, action: PayloadAction<SpotifyTrack | null>) => {
      state.selectedTrack = action.payload;
    }
  },
});

export const spotifyStore = configureStore({
  reducer: { spotify: spotifySlice.reducer },
});

export type RootState = ReturnType<typeof spotifyStore.getState>;
export type AppDispatch = typeof spotifyStore.dispatch;

export default spotifySlice.reducer;