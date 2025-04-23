import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/lib/store';
import convert from 'color-convert';
export function useTheme() {
  const dispatch = useDispatch();
  const { palette, isCustomPalette } = useSelector((state: RootState) => state.theme);

  const applyPalette = (colours: number[][]) => {
    if (!colours || colours.length < 4) return;
    console.log("Colours: ", colours)
    // Update Redux state
    dispatch({ type: 'theme/setThemePallete', payload: colours});


    // Convert RGB values to HSL and update CSS variables
    colours.forEach((rgb, index) => {
      const [h, s, l] = convert.rgb.hsl(rgb[0], rgb[1], rgb[2])

      // Map colours to blob variables
      const variableName = index === 0 ? '--blob-primary' :
                          index === 1 ? '--blob-secondary' :
                          index === 2 ? '--blob-tertiary' :
                          index === 3 ? '--gradient-end' : null;
      
      if (variableName) {
        document.documentElement.style.setProperty(
          variableName,
          `${h} ${s}% ${l}%`
        );
      }
    });
  };

  const resetPalette = () => {
    dispatch({ type: 'theme/resetThemePalette'});
    // Reset to default values
    // Reset to default theme colours
    document.documentElement.style.removeProperty('--blob-primary');
    document.documentElement.style.removeProperty('--blob-secondary');
    document.documentElement.style.removeProperty('--blob-tertiary');
    document.documentElement.style.removeProperty('--gradient-end');
  };

  return {
    currentPalette: palette,
    isCustomPalette,
    applyPalette,
    resetPalette
  };
}

export default useTheme;
