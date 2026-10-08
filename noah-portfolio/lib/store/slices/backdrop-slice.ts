import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  BackdropPresetName,
  DEFAULT_BACKDROP_PRESET,
  isBackdropPresetName,
} from '@/lib/backdrop/presets';

interface BackdropState {
  preset: BackdropPresetName;
  /** True while the home sky shows: from a reset until an answer, the stream or a theme sets a preset. */
  home: boolean;
}

const initialState: BackdropState = {
  preset: DEFAULT_BACKDROP_PRESET,
  home: true,
};

export const backdropSlice = createSlice({
  name: 'backdrop',
  initialState,
  reducers: {
    // Allowlist enforcement: unknown preset names are a silent no-op.
    setBackdropPreset: (state, action: PayloadAction<string>) => {
      if (isBackdropPresetName(action.payload)) {
        state.preset = action.payload;
        state.home = false;
      }
    },
    resetBackdropPreset: (state) => {
      state.preset = DEFAULT_BACKDROP_PRESET;
      state.home = true;
    },
  },
});

export const { setBackdropPreset, resetBackdropPreset } = backdropSlice.actions;
export const selectBackdropPreset = (state: { backdrop: BackdropState }) => state.backdrop.preset;
export default backdropSlice.reducer;
