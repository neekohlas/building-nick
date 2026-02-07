import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export interface StravaAuthStatus {
  connected: boolean
  athleteName?: string
  error?: string
}

// Cache access token in memory (per server instance)
let accessTokenCache: { token: string; expiresAt: number } | null = null

/**
 * GET /api/auth/strava/status
 * Checks if user has valid Strava connection
 */
export async function GET(): Promise<NextResponse<StravaAuthStatus>> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('strava_refresh_token')?.value
  const athleteName = cookieStore.get('strava_athlete_name')?.value

  if (!refreshToken) {
    return NextResponse.json({ connected: false })
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ connected: false, error: 'Strava OAuth not configured' })
  }

  try {
    const result = await getStravaAccessToken(refreshToken, clientId, clientSecret)

    if (!result) {
      return NextResponse.json({ connected: false, error: 'Failed to refresh access token' })
    }

    // If Strava rotated the refresh token, update the cookie
    if (result.newRefreshToken) {
      cookieStore.set('strava_refresh_token', result.newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/'
      })
    }

    return NextResponse.json({ connected: true, athleteName })

  } catch (error) {
    console.error('Strava status check error:', error)
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Gets a valid Strava access token, using cache or refreshing if needed.
 * Strava access tokens expire every 6 hours.
 * Note: Strava may return a new refresh_token on refresh — caller should handle cookie update if needed.
 */
export async function getStravaAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; newRefreshToken?: string } | null> {
  // Check cache first (with 60s buffer before expiry)
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60000) {
    return { accessToken: accessTokenCache.token }
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Strava] Token refresh failed (${response.status}):`, errorText)
      accessTokenCache = null // Clear stale cache
      return null
    }

    const data = await response.json()

    // Strava returns expires_at (unix timestamp) rather than expires_in
    accessTokenCache = {
      token: data.access_token,
      expiresAt: data.expires_at * 1000 // Convert to milliseconds
    }

    // Strava may rotate the refresh token on refresh — return new one if provided
    const result: { accessToken: string; newRefreshToken?: string } = {
      accessToken: data.access_token
    }
    if (data.refresh_token && data.refresh_token !== refreshToken) {
      result.newRefreshToken = data.refresh_token
    }

    return result

  } catch (error) {
    console.error('Error refreshing Strava token:', error)
    return null
  }
}
