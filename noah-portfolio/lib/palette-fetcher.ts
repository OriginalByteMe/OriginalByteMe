const palette_worker_url = process.env.COLOUR_PALETTE_URL || 'https://spotify-palette.arknet.workers.dev'

export const fetchColourPaletteFromImage = async (imageUrl: string) => {
  try {
    const response = await fetch(`${palette_worker_url}/api/palette?buckets=5`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: imageUrl,
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch palette: ${response.status} ${response.statusText}`)
    }
    
    return await response.json()
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