import { NextRequest, NextResponse } from 'next/server'

const APP_PASSWORD = process.env.APP_PASSWORD

// iOS standalone PWAs can lose cookies with only maxAge — set explicit expires too
const oneYear = 60 * 60 * 24 * 365
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: oneYear,
  expires: new Date(Date.now() + oneYear * 1000),
  path: '/',
}

export async function POST(request: NextRequest) {
  // If no password is configured (empty or not set), allow access (dev mode)
  if (!APP_PASSWORD || APP_PASSWORD.trim() === '') {
    console.warn('APP_PASSWORD not set - authentication disabled')
    const response = NextResponse.json({ success: true })
    response.cookies.set('auth-token', 'dev-mode', COOKIE_OPTIONS)
    return response
  }

  try {
    const { password } = await request.json()

    if (password === APP_PASSWORD) {
      // Create a simple token (in production, use a proper JWT or session)
      const token = Buffer.from(`${Date.now()}-${APP_PASSWORD}`).toString('base64')

      const response = NextResponse.json({ success: true })
      response.cookies.set('auth-token', token, COOKIE_OPTIONS)
      return response
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
