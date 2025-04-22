import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ThemeState {
  palette: number[][];
  isCustomPalette: boolean;
}

const initialState: ThemeState = {
  palette: [],
  isCustomPalette: false
};

export const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setThemePalette: (state, action: PayloadAction<number[][]>) => {
      state.palette = action.payload;
      state.isCustomPalette = true;
    },
    resetThemePalette: (state) => {
      state.palette = [];
      state.isCustomPalette = false;
    }
  },
});

export const { setThemePalette, resetThemePalette } = themeSlice.actions;
export default themeSlice.reducer;
