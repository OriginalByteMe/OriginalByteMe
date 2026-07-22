import { SpotifyNowPlaying } from "noah-portfolio";

// SpotifyNowPlaying — Noah's current-track reveal. Renders its closed pill by
// default; opening it fetches the live track list from the Spotify slice.

export const Closed = () => <SpotifyNowPlaying props={{}} />;
