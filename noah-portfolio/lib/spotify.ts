/**
 * Spotify API utility functions
 * This file contains functions to authenticate with Spotify API and handle token refresh
 */

const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_ENDPOINT = 'https://api.spotify.com/v1';

/**
 * Get a new access token using the refresh token
 * @returns {Promise<{ access_token: string, expires_in: number }>}
 */
export const getAccessToken = async (): Promise<{ access_token: string; expires_in: number }> => {
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!refresh_token) {
    throw new Error('SPOTIFY_REFRESH_TOKEN is not defined in environment variables');
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not defined in environment variables');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to refresh token: ${error.error_description || 'Unknown error'}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  } catch (error) {
    console.error('Error refreshing Spotify access token:', error);
    throw error;
  }
};

/**
 * Make an authenticated request to the Spotify API
 * @param {string} endpoint - The API endpoint to call (without the base URL)
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<any>} - The JSON response from the API
 */
export const spotifyFetch = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const { access_token } = await getAccessToken();

  const response = await fetch(`${SPOTIFY_API_ENDPOINT}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${access_token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Spotify API error: ${error.error?.message || 'Unknown error'}`);
  }

  return response.json();
};

/**
 * Invalidate the current access token (not commonly needed)
 * This is rarely used but included for completeness
 */
export const invalidateToken = async (): Promise<void> => {
  // Spotify doesn't have a direct method to invalidate tokens
  // The token will naturally expire after its lifetime
  // This function is a placeholder for future implementation if needed
  console.log('Token invalidation requested - tokens expire automatically after their lifetime');
};
