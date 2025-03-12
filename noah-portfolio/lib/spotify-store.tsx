"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  albumCover?: string;
  songUrl: string;
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
    const fetchTopTracks = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/spotify/top-tracks');
        
        if (!response.ok) {
          throw new Error('Failed to fetch top tracks');
        }
        
        const data = await response.json();
        
        if (data.tracks && data.tracks.length > 0) {
          setTracks(data.tracks);
        } else {
          // Fallback to demo data if no tracks are returned
          setTracks([
            {
              id: '1',
              title: 'Blinding Lights',
              artist: 'The Weeknd',
              albumCover: '/placeholder.svg?height=40&width=40',
              songUrl: 'https://open.spotify.com'
            },
            {
              id: '2',
              title: 'Shape of You',
              artist: 'Ed Sheeran',
              albumCover: '/placeholder.svg?height=40&width=40',
              songUrl: 'https://open.spotify.com'
            },
            {
              id: '3',
              title: 'Dance Monkey',
              artist: 'Tones and I',
              albumCover: '/placeholder.svg?height=40&width=40',
              songUrl: 'https://open.spotify.com'
            },
            {
              id: '4',
              title: 'Someone You Loved',
              artist: 'Lewis Capaldi',
              albumCover: '/placeholder.svg?height=40&width=40',
              songUrl: 'https://open.spotify.com'
            },
            {
              id: '5',
              title: 'Watermelon Sugar',
              artist: 'Harry Styles',
              albumCover: '/placeholder.svg?height=40&width=40',
              songUrl: 'https://open.spotify.com'
            }
          ]);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching top tracks:', err);
        setError('Failed to load Spotify tracks');
        // Set fallback demo data
        setTracks([
          {
            id: '1',
            title: 'Blinding Lights',
            artist: 'The Weeknd',
            albumCover: '/placeholder.svg?height=40&width=40',
            songUrl: 'https://open.spotify.com'
          },
          {
            id: '2',
            title: 'Shape of You',
            artist: 'Ed Sheeran',
            albumCover: '/placeholder.svg?height=40&width=40',
            songUrl: 'https://open.spotify.com'
          },
          {
            id: '3',
            title: 'Dance Monkey',
            artist: 'Tones and I',
            albumCover: '/placeholder.svg?height=40&width=40',
            songUrl: 'https://open.spotify.com'
          },
          {
            id: '4',
            title: 'Someone You Loved',
            artist: 'Lewis Capaldi',
            albumCover: '/placeholder.svg?height=40&width=40',
            songUrl: 'https://open.spotify.com'
          },
          {
            id: '5',
            title: 'Watermelon Sugar',
            artist: 'Harry Styles',
            albumCover: '/placeholder.svg?height=40&width=40',
            songUrl: 'https://open.spotify.com'
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopTracks();
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
