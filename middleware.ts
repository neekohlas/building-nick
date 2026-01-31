import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/logout']

// API routes that need protection
const protectedApiRoutes = ['/api/activities', '/api/calendar', '/api/weather', '/api/coach']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // If no APP_PASSWORD is set (empty or missing), skip auth entirely (dev mode)
  const appPassword = process.env.APP_PASSWORD
  if (!appPassword || appPassword.trim() === '') {
    return NextResponse.next()
  }

  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for auth token
  const authToken = request.cookies.get('auth-token')?.value

  // Check if token is dev-mode (set when no password was configured at login time)
  if (authToken === 'dev-mode') {
    return NextResponse.next()
  }

  // Check if token exists and is valid (basic check)
  if (!authToken) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // For page routes, redirect to login
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Token exists - allow the request
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
