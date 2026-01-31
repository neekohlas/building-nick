import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google
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
    console.error('Google OAuth error:', error)
    return NextResponse.redirect(`${appUrl}?calendar_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}?calendar_error=missing_params`)
  }

  // Verify CSRF state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('google_oauth_state')?.value

  if (!storedState || storedState !== state) {
    console.error('CSRF state mismatch')
    return NextResponse.redirect(`${appUrl}?calendar_error=state_mismatch`)
  }

  // Clear the state cookie
  cookieStore.delete('google_oauth_state')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}?calendar_error=not_configured`)
  }

  try {
    const redirectUri = `${appUrl}/api/auth/google/callback`

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(`${appUrl}?calendar_error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    if (!tokens.refresh_token) {
      console.error('No refresh token received')
      return NextResponse.redirect(`${appUrl}?calendar_error=no_refresh_token`)
    }

    // Get user email using the access token
    let userEmail = ''
    try {
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`
        }
      })
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json()
        userEmail = userInfo.email || ''
      }
    } catch (e) {
      console.warn('Failed to fetch user email:', e)
    }

    // Store refresh token in HttpOnly secure cookie
    cookieStore.set('google_refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/'
    })

    // Store email in a readable cookie for display purposes
    if (userEmail) {
      cookieStore.set('google_calendar_email', userEmail, {
        httpOnly: false, // Accessible by client for display
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/'
      })
    }

    // Redirect back to app with success
    return NextResponse.redirect(`${appUrl}?calendar_connected=true`)

  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${appUrl}?calendar_error=server_error`)
  }
}
