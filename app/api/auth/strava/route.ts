import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/auth/strava
 * Initiates Strava OAuth 2.0 flow
 * Redirects user to Strava's consent screen
 */
export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID

  if (!clientId) {
    return NextResponse.json({
      success: false,
      error: 'Strava OAuth not configured'
    }, { status: 500 })
  }

  // Generate CSRF state token
  const state = crypto.randomUUID()

  // Store state in cookie for verification on callback
  const cookieStore = await cookies()
  cookieStore.set('strava_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/'
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const redirectUri = `${appUrl}/api/auth/strava/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
    approval_prompt: 'force',
    state: state
  })

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`

  return NextResponse.redirect(stravaAuthUrl)
}
