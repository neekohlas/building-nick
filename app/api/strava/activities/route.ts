import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getStravaAccessToken } from '../../auth/strava/status/route'

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date_local: string
  elapsed_time: number
  moving_time: number
  distance: number
  average_speed: number
  max_speed: number
  total_elevation_gain: number
  kilojoules?: number
  average_heartrate?: number
  has_heartrate?: boolean
}

export interface StravaActivitiesResponse {
  success: boolean
  activities?: StravaActivity[]
  error?: string
}

/**
 * GET /api/strava/activities
 * Fetches recent activities from Strava
 * Query params:
 *   - after: Unix epoch timestamp (default: 7 days ago)
 *   - per_page: Number of results (default: 30, max: 200)
 */
export async function GET(request: Request): Promise<NextResponse<StravaActivitiesResponse>> {
  const { searchParams } = new URL(request.url)

  // Default to 7 days ago
  const defaultAfter = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000)
  const after = parseInt(searchParams.get('after') || String(defaultAfter))
  const perPage = Math.min(parseInt(searchParams.get('per_page') || '30'), 200)

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('strava_refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: 'not_connected' })
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ success: false, error: 'Strava OAuth not configured' })
  }

  try {
    const result = await getStravaAccessToken(refreshToken, clientId, clientSecret)
    if (!result) {
      return NextResponse.json({ success: false, error: 'Failed to refresh access token' })
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

    const url = new URL('https://www.strava.com/api/v3/athlete/activities')
    url.searchParams.set('after', String(after))
    url.searchParams.set('per_page', String(perPage))

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${result.accessToken}` }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Strava] Activities fetch failed (${response.status}):`, errorText)
      return NextResponse.json({ success: false, error: `Strava API error ${response.status}: ${errorText.substring(0, 200)}` })
    }

    const activities: StravaActivity[] = await response.json()

    console.log(`[Strava] Fetched ${activities.length} activities (after=${after}, per_page=${perPage})`)

    return NextResponse.json({ success: true, activities })

  } catch (error) {
    console.error('Strava activities error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch activities'
    })
  }
}
