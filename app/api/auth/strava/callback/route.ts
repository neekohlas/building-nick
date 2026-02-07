import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/auth/strava/callback
 * Handles OAuth callback from Strava
 * Exchanges authorization code for tokens
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    console.error('Strava OAuth error:', error)
    return NextResponse.redirect(`${appUrl}?strava_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}?strava_error=missing_params`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('strava_oauth_state')?.value

  if (!storedState || storedState !== state) {
    console.error('CSRF state mismatch')
    return NextResponse.redirect(`${appUrl}?strava_error=state_mismatch`)
  }

  // Clear the state cookie
  cookieStore.delete('strava_oauth_state')

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}?strava_error=not_configured`)
  }

  try {
    // Exchange code for tokens (Strava uses JSON body)
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Strava token exchange failed:', errorText)
      return NextResponse.redirect(`${appUrl}?strava_error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    // Strava returns: { access_token, refresh_token, expires_at, athlete: { id, firstname, lastname, ... } }

    if (!tokens.refresh_token) {
      console.error('No refresh token received')
      return NextResponse.redirect(`${appUrl}?strava_error=no_refresh_token`)
    }

    // Store refresh token in HttpOnly secure cookie
    cookieStore.set('strava_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/'
    })

    // Store athlete name in a readable cookie for display
    const athleteName = tokens.athlete
      ? `${tokens.athlete.firstname || ''} ${tokens.athlete.lastname || ''}`.trim()
      : ''
    if (athleteName) {
      cookieStore.set('strava_athlete_name', athleteName, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/'
      })
    }

    // Redirect back to app with success
    return NextResponse.redirect(`${appUrl}?strava_connected=true`)

  } catch (error) {
    console.error('Strava OAuth callback error:', error)
    return NextResponse.redirect(`${appUrl}?strava_error=server_error`)
  }
}
