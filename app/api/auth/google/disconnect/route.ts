import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * POST /api/auth/google/disconnect
 * Revokes Google access and clears stored tokens
 */
export async function POST() {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('google_refresh_token')?.value

  // Try to revoke the token with Google (best effort)
  if (refreshToken) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${refreshToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })
    } catch (error) {
      console.warn('Token revocation failed (continuing anyway):', error)
    }
  }

  // Clear all Google-related cookies
  cookieStore.delete('google_refresh_token')
  cookieStore.delete('google_calendar_email')
  cookieStore.delete('google_oauth_state')

  return NextResponse.json({
    success: true,
    message: 'Disconnected from Google Calendar'
  })
}
