import { NextRequest, NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

/**
 * GET handler for retrieving the user's recently played tracks
 * @param request The incoming request
 */
export async function GET(request: NextRequest) {
  try {
    // Get the 5 most recently played tracks
    const response = await spotifyFetch('/me/player/recently-played?limit=5');
    
    if (!response || !response.items || response.items.length === 0) {
      return NextResponse.json(
        { tracks: [] },
        { status: 200 }
      );
    }

    // The recently played endpoint returns items with a different structure
    // Each item has a 'track' property containing the track data
    const tracks = response.items.map((item: any) => {
      const track = item.track;
      return {
        id: track.id,
        title: track.name,
        artist: track.artists.map((artist: { name: string }) => artist.name).join(', '),
        albumCover: track.album.images[0]?.url,
        songUrl: track.external_urls.spotify,
        // Add an empty color palette that will be filled by the store
        colourPalette: []
      };
    });

    return NextResponse.json(
      { tracks },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in Spotify recently-played API:', error);
    return NextResponse.json(
      { error: 'Failed to get recently played tracks', tracks: [] },
      { status: 500 }
    );
  }
}
