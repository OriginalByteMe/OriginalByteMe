import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import {
  BackdropPresetName,
  DEFAULT_BACKDROP_PRESET,
  isBackdropPresetName,
} from '@/lib/backdrop/presets';

interface BackdropState {
  preset: BackdropPresetName;
}

const initialState: BackdropState = {
  preset: DEFAULT_BACKDROP_PRESET,
};

export const backdropSlice = createSlice({
  name: 'backdrop',
  initialState,
  reducers: {
    // Allowlist enforcement: unknown preset names are a silent no-op.
    setBackdropPreset: (state, action: PayloadAction<string>) => {
      if (isBackdropPresetName(action.payload)) {
        state.preset = action.payload;
      }
    },
    resetBackdropPreset: (state) => {
      state.preset = DEFAULT_BACKDROP_PRESET;
    },
  },
});

export const { setBackdropPreset, resetBackdropPreset } = backdropSlice.actions;
export const selectBackdropPreset = (state: { backdrop: BackdropState }) => state.backdrop.preset;
export default backdropSlice.reducer;
