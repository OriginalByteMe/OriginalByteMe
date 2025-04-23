import { NextRequest, NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

/**
 * GET handler for retrieving the user's recently played tracks
 * @param request The incoming request
 */
export async function GET(request: NextRequest) {
  try {
    // Get the limit from URL params or default to 5
    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit') || '5');
    
    // Ensure limit is between 1 and 50
    limit = Math.min(Math.max(limit, 1), 50);

    // Get the specified number of recently played tracks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await spotifyFetch(`/me/player/recently-played?limit=${limit}`);
    
    if (!response || !response.items || response.items.length === 0) {
      return NextResponse.json(
        { tracks: [] },
        { status: 200 }
      );
    }

    // The recently played endpoint returns items with a different structure
    // Each item has a 'track' property containing the track data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
