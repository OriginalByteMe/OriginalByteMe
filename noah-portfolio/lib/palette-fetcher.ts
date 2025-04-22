const palette_worker_url = process.env.COLOUR_PALETTE_URL

export const fetchColourPaletteFromImage = async (imageUrl: string) => {
  try {
    const response = await fetch(`${palette_worker_url}/api/palette?buckets=4`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: imageUrl,
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch palette: ${response}`)
    }

    const data = await response.json()
    
    // Transform the palette from string format to array format
    if (data.palette && Array.isArray(data.palette)) {
      // Convert each color from "r,g,b" string format to [r,g,b] array format
      const transformedPalette = data.palette.map((colorStr: string) => {
        if (typeof colorStr === 'string') {
          return colorStr.split(',').map(Number)
        }
        return colorStr // Return as is if already in correct format
      })
      return transformedPalette
    }
    
    return data
  } catch (error) {
    console.error('Error fetching color palette:', error)
    // Return a default palette on error
    return [
      [52, 211, 153], // Emerald
      [16, 185, 129],
      [5, 150, 105],
      [4, 120, 87],
      [6, 95, 70]
    ]
  }
}