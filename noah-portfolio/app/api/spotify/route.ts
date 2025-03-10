import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, spotifyFetch, invalidateToken } from '@/lib/spotify';

/**
 * GET handler for retrieving a new access token
 * @param request The incoming request
 */
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getAccessToken();
    return NextResponse.json(
      { 
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in Spotify token API:', error);
    return NextResponse.json(
      { error: 'Failed to get access token' },
      { status: 500 }
    );
  }
}

/**
 * POST handler for invalidating the current token
 * @param request The incoming request
 */
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'invalidate') {
      await invalidateToken();
      return NextResponse.json(
        { message: 'Token invalidation requested' },
        { status: 200 }
      );
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in Spotify token API:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
