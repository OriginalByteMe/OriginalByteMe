import { palette } from "@/app/utils/types";
export interface ISpotifyState {
  tracks: SpotifyTrack[];
  isLoading: boolean;
  error: string | null;
  selectedTrack: SpotifyTrack | null;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  albumCover?: string;
  songUrl: string;
  colourPalette: palette;
}

export interface SpotifyStoreContextType {
  tracks: SpotifyTrack[];
  isLoading: boolean;
  error: string | null;
  selectedTrack: SpotifyTrack | null;
}
