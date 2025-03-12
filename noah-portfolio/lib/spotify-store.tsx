"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  albumCover?: string;
  songUrl: string;
  colourPalette: number[][];
}

interface SpotifyStoreContextType {
  tracks: SpotifyTrack[];
  isLoading: boolean;
  error: string | null;
}

const SpotifyStoreContext = createContext<SpotifyStoreContextType | undefined>(undefined);

export function SpotifyStoreProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchColorPalette = async (track: SpotifyTrack): Promise<SpotifyTrack> => {
      if (!track.albumCover) {
        // If no album cover, return the track with default palette
        return {
          ...track,
          colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]]
        };
      }
      
      try {
        const response = await fetch('/api/spotify/palette-picker', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl: track.albumCover }),
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch color palette');
        }
        
        const data = await response.json();
        
        return {
          ...track,
          colourPalette: data.palette || [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]]
        };
      } catch (error) {
        console.error('Error fetching color palette:', error);
        // Return track with default palette on error
        return {
          ...track,
          colourPalette: [[255, 255, 255], [0, 0, 0], [255, 0, 0], [0, 255, 0], [0, 0, 255]]
        };
      }
    };
    
    const fetchRecentlyPlayedTracks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/spotify/recently-played');
        
        if (!response.ok) {
          throw new Error('Failed to fetch recently played tracks');
        }
        
        const data = await response.json();
        
        if (data.tracks && data.tracks.length > 0) {
          // Fetch color palettes for each track
          const tracksWithPalettes = await Promise.all(
            data.tracks.map((track: SpotifyTrack) => fetchColorPalette(track))
          );
          
          setTracks(tracksWithPalettes);
        } else {
          // Fallback to demo data if no tracks are returned
          setTracks([
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
          ]);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching recently played tracks:', err);
        setError('Failed to load recently played Spotify tracks');
        // Set fallback demo data
        setTracks([
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
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentlyPlayedTracks();
  }, []);

  return (
    <SpotifyStoreContext.Provider value={{ tracks, isLoading, error }}>
      {children}
    </SpotifyStoreContext.Provider>
  );
}

export function useSpotifyStore() {
  const context = useContext(SpotifyStoreContext);
  if (context === undefined) {
    throw new Error('useSpotifyStore must be used within a SpotifyStoreProvider');
  }
  return context;
}
