import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getStravaAccessToken } from '../status/route'

/**
 * POST /api/auth/strava/disconnect
 * Deauthorizes Strava access and clears stored tokens
 */
export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('strava_refresh_token')?.value

  // Deauthorize with Strava (best effort)
  if (refreshToken) {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

    if (clientId && clientSecret) {
      try {
        const accessToken = await getStravaAccessToken(refreshToken, clientId, clientSecret)
        if (accessToken) {
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
        }
      } catch (error) {
        console.warn('Strava deauthorization failed (continuing anyway):', error)
      }
    }
  }

  // Clear all Strava-related cookies
  cookieStore.delete('strava_refresh_token')
  cookieStore.delete('strava_athlete_name')
  cookieStore.delete('strava_oauth_state')

  return NextResponse.json({
    success: true,
    message: 'Disconnected from Strava'
  })
}
