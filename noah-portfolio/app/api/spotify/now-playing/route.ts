import { NextRequest, NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

/**
 * GET handler for retrieving the currently playing track
 * @param request The incoming request
 */
export async function GET(request: NextRequest) {
  try {
    const response = await spotifyFetch('/me/player/currently-playing');
    
    if (!response || !response.item) {
      return NextResponse.json(
        { isPlaying: false },
        { status: 200 }
      );
    }

    const track = response.item;
    const isPlaying = response.is_playing;
    const title = track.name;
    const artist = track.artists.map((artist: { name: string }) => artist.name).join(', ');
    const album = track.album.name;
    const albumImageUrl = track.album.images[0]?.url;
    const songUrl = track.external_urls.spotify;

    return NextResponse.json(
      {
        isPlaying,
        title,
        artist,
        album,
        albumImageUrl,
        songUrl
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in Spotify now-playing API:', error);
    return NextResponse.json(
      { error: 'Failed to get currently playing track', isPlaying: false },
      { status: 500 }
    );
  }
}
