import { NextRequest, NextResponse } from 'next/server';
import { fetchColourPaletteFromImage } from '@/lib/palette-fetcher'

export async function POST(request: NextRequest) {
  try {
    // Retrieve image url from selected image and pass to api
    const body = await request.json();
    const { imageUrl } = body;
    
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }
    
    console.log('Fetching palette for image:', imageUrl);
    const palette = await fetchColourPaletteFromImage(imageUrl);
    console.log('Palette received:', palette);
    
    return NextResponse.json(
      { palette },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in Spotify palette-picker API:', error);
    // Return a default palette on error
    const defaultPalette = [
      [52, 211, 153], // Emerald
      [16, 185, 129],
      [5, 150, 105],
      [4, 120, 87],
      [6, 95, 70]
    ];
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        palette: defaultPalette 
      },
      { status: 200 }
    );
  }
}