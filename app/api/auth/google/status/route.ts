import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export interface Calendar {
  id: string
  name: string
  primary: boolean
  color: string
}

export interface GoogleAuthStatus {
  connected: boolean
  email?: string
  calendars?: Calendar[]
  error?: string
}

// Cache access tokens in memory (per server instance)
let accessTokenCache: { token: string; expiresAt: number } | null = null

/**
 * GET /api/auth/google/status
 * Checks if user has valid Google Calendar connection
 * Returns connection status, email, and available calendars
 */
export async function GET(): Promise<NextResponse<GoogleAuthStatus>> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('google_refresh_token')?.value
  const email = cookieStore.get('google_calendar_email')?.value

  if (!refreshToken) {
    return NextResponse.json({
      connected: false
    })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      connected: false,
      error: 'Google OAuth not configured'
    })
  }

  try {
    // Get a fresh access token
    const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)

    if (!accessToken) {
      return NextResponse.json({
        connected: false,
        error: 'Failed to refresh access token'
      })
    }

    // Fetch list of calendars
    const calendarsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text()
      console.error('Failed to fetch calendars:', errorText)
      return NextResponse.json({
        connected: false,
        error: 'Failed to fetch calendars'
      })
    }

    const calendarsData = await calendarsResponse.json()

    const calendars: Calendar[] = (calendarsData.items || []).map((cal: {
      id: string
      summary?: string
      primary?: boolean
      backgroundColor?: string
    }) => ({
      id: cal.id,
      name: cal.summary || 'Untitled',
      primary: cal.primary || false,
      color: cal.backgroundColor || '#4285f4'
    }))

    return NextResponse.json({
      connected: true,
      email,
      calendars
    })

  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Gets a valid access token, using cache or refreshing if needed
 */
async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  // Check cache first
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now() + 60000) {
    return accessTokenCache.token
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token refresh failed:', errorText)
      return null
    }

    const data = await response.json()

    // Cache the new access token
    accessTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000)
    }

    return data.access_token

  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}

// Export for use by other routes
export { getAccessToken }
