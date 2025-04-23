import { NextResponse } from 'next/server';
import { spotifyFetch } from '@/lib/spotify';

/**
 * GET handler for retrieving the user's top 5 tracks
 * @param request The incoming request
 */
export async function GET() {
  try {
    // Get the top 5 tracks from the user's profile
    // time_range can be: short_term (4 weeks), medium_term (6 months), long_term (years)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await spotifyFetch('/me/top/tracks?limit=5&time_range=medium_term');
    
    if (!response || !response.items || response.items.length === 0) {
      return NextResponse.json(
        { tracks: [] },
        { status: 200 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tracks = response.items.map((track: any) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist: { name: string }) => artist.name).join(', '),
      albumCover: track.album.images[0]?.url,
      songUrl: track.external_urls.spotify,
      colourPallete: []
    }));

    return NextResponse.json(
      { tracks },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in Spotify top-tracks API:', error);
    return NextResponse.json(
      { error: 'Failed to get top tracks', tracks: [] },
      { status: 500 }
    );
  }
}
