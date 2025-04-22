"use client"

import { SpotifyTrack } from "@/app/utils/interfaces";
import { useDispatch } from "react-redux";

const useSpotify = () => {
  const dispatch = useDispatch();

  const demoTracks: SpotifyTrack[] = [
    {
      id: '1',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      albumCover: '/placeholder.svg?height=40&width=40',
      songUrl: 'https://open.spotify.com',
      colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0]]
    },
    {
      id: '2',
      title: 'Shape of You',
      artist: 'Ed Sheeran',
      albumCover: '/placeholder.svg?height=40&width=40',
      songUrl: 'https://open.spotify.com',
      colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0]]
    },
    {
      id: '3',
      title: 'Dance Monkey',
      artist: 'Tones and I',
      albumCover: '/placeholder.svg?height=40&width=40',
      songUrl: 'https://open.spotify.com',
      colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0]]
    },
    {
      id: '4',
      title: 'Someone You Loved',
      artist: 'Lewis Capaldi',
      albumCover: '/placeholder.svg?height=40&width=40',
      songUrl: 'https://open.spotify.com',
      colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0]]
    },
    {
      id: '5',
      title: 'Watermelon Sugar',
      artist: 'Harry Styles',
      albumCover: '/placeholder.svg?height=40&width=40',
      songUrl: 'https://open.spotify.com',
      colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0]]
    }
  ];

  // Fetch color palette for a single track
    async function fetchColourPalette(track: SpotifyTrack): Promise<SpotifyTrack> {
        if (!track.albumCover) {
        return { ...track, colourPalette: demoTracks[0].colourPalette };
        }
        try {
        const response = await fetch('/api/spotify/palette-picker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl: track.albumCover })
        });
        if (!response.ok) throw new Error('Failed to fetch color palette');
        const data = await response.json();
        let palette = data.palette;
        if (Array.isArray(palette) && palette.length > 0) {
            if (!Array.isArray(palette[0])) {
            palette = palette.map((c: string | number[]) => typeof c === 'string' && c.includes(',') ? c.split(',').map(Number) : Array.isArray(c) ? c : demoTracks[0].colourPalette);
            }
        } else {
            palette = demoTracks[0].colourPalette;
        }
        return { ...track, colourPalette: palette };
        } catch (err) {
        console.error('Error fetching color palette:', err);
        return { ...track, colourPalette: demoTracks[0].colourPalette };
        }
    }
  
  // Fetch recently played tracks with palettes
  async function fetchRecentlyPlayedTracksFromApi(): Promise<SpotifyTrack[]> {
    try {
      const res = await fetch('/api/spotify/recently-played');
      if (!res.ok) throw new Error('Failed to fetch recently played tracks');
      const data = await res.json();
      if (data.tracks && data.tracks.length > 0) {
        return await Promise.all(data.tracks.map((t: SpotifyTrack) => fetchColourPalette(t)));
      }
      return demoTracks;
    } catch (err) {
      console.error('Error fetching recently played tracks:', err);
      throw err;
    }
  }

  async function fetchSpotifyTracksAndPalettes() {
    dispatch({ type: 'spotify/setLoading', payload: true });
    try {
      const trackData = await fetchRecentlyPlayedTracksFromApi() as SpotifyTrack[];
      const updatedTracks = await Promise.all(
        trackData.map(async (track) => {
          try {
            const paletteResult = await fetchColourPalette(track);
            return { ...track, colourPalette: paletteResult.colourPalette };
          } catch (err) {
            console.error('Error fetching color palette:', err as Error);
            return { ...track, colourPalette: demoTracks[0].colourPalette };
          }
        })
      );
      
      dispatch({ type: 'spotify/setTracks', payload: updatedTracks });
      dispatch({ type: 'spotify/setLoading', payload: false });
    } catch (err) {
      console.error('Error fetching tracks and palettes:', err as Error);
      dispatch({ type: 'spotify/setError', payload: (err as Error).message });
      dispatch({ type: 'spotify/setLoading', payload: false });
      dispatch({ type: 'spotify/setTracks', payload: demoTracks });
    }
  }
  

  return { fetchRecentlyPlayedTracksFromApi, fetchColourPalette, fetchSpotifyTracksAndPalettes };
};


export default useSpotify;
