import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO datetime
  end: string // ISO datetime
  allDay: boolean
  calendarId: string
  calendarName: string
  color: string
  location?: string
  description?: string
}

export interface CalendarEventsResponse {
  success: boolean
  events?: CalendarEvent[]
  error?: string
  cached?: boolean
}

// In-memory cache for events
interface EventsCache {
  data: CalendarEvent[]
  timestamp: number
  cacheKey: string
}
let eventsCache: EventsCache | null = null
const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes

/**
 * GET /api/calendar/events
 * Fetches calendar events for a date range
 * Query params:
 *   - start: ISO date string (YYYY-MM-DD) - required
 *   - end: ISO date string (YYYY-MM-DD) - required
 *   - calendarIds: comma-separated list of calendar IDs (optional, defaults to all)
 */
export async function GET(request: Request): Promise<NextResponse<CalendarEventsResponse>> {
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const calendarIdsParam = searchParams.get('calendarIds')

  if (!start || !end) {
    return NextResponse.json({
      success: false,
      error: 'Missing start or end date parameters'
    })
  }

  const cookieStore = await cookies()
  const refreshToken = cookieStore.get('google_refresh_token')?.value

  if (!refreshToken) {
    return NextResponse.json({
      success: false,
      error: 'not_connected'
    })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      success: false,
      error: 'Google OAuth not configured'
    })
  }

  // Create cache key from parameters
  const cacheKey = `${start}_${end}_${calendarIdsParam || 'all'}`

  // Check cache
  if (eventsCache &&
      eventsCache.cacheKey === cacheKey &&
      Date.now() - eventsCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      events: eventsCache.data,
      cached: true
    })
  }

  try {
    // Get access token
    const accessToken = await getAccessToken(refreshToken, clientId, clientSecret)

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Failed to refresh access token'
      })
    }

    // Fetch calendar list to get names and colors
    const calendarsResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    )

    if (!calendarsResponse.ok) {
      throw new Error('Failed to fetch calendars')
    }

    const calendarsData = await calendarsResponse.json()
    const calendarMap = new Map<string, { name: string; color: string }>()

    for (const cal of calendarsData.items || []) {
      calendarMap.set(cal.id, {
        name: cal.summary || 'Untitled',
        color: cal.backgroundColor || '#4285f4'
      })
    }

    // Determine which calendars to fetch
    let calendarIds: string[]
    if (calendarIdsParam) {
      calendarIds = calendarIdsParam.split(',').filter(id => calendarMap.has(id))
    } else {
      calendarIds = Array.from(calendarMap.keys())
    }

    // Fetch events from each calendar
    const allEvents: CalendarEvent[] = []
    const timeMin = `${start}T00:00:00Z`
    const timeMax = `${end}T23:59:59Z`

    // Use AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    try {
      await Promise.all(
        calendarIds.map(async (calendarId) => {
          const eventsUrl = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
          )
          eventsUrl.searchParams.set('timeMin', timeMin)
          eventsUrl.searchParams.set('timeMax', timeMax)
          eventsUrl.searchParams.set('singleEvents', 'true')
          eventsUrl.searchParams.set('orderBy', 'startTime')
          eventsUrl.searchParams.set('maxResults', '100')

          const response = await fetch(eventsUrl.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal
          })

          if (!response.ok) {
            console.warn(`Failed to fetch events for calendar ${calendarId}:`, response.status)
            return
          }

          const data = await response.json()
          const calInfo = calendarMap.get(calendarId)

          for (const event of data.items || []) {
            // Skip cancelled events
            if (event.status === 'cancelled') continue

            // Handle all-day events vs timed events
            const isAllDay = !!event.start?.date
            const startTime = event.start?.dateTime || event.start?.date
            const endTime = event.end?.dateTime || event.end?.date

            if (!startTime || !endTime) continue

            allEvents.push({
              id: event.id,
              title: event.summary || '(No title)',
              start: startTime,
              end: endTime,
              allDay: isAllDay,
              calendarId,
              calendarName: calInfo?.name || 'Unknown',
              color: calInfo?.color || '#4285f4',
              location: event.location,
              description: event.description
            })
          }
        })
      )
    } finally {
      clearTimeout(timeoutId)
    }

    // Sort events by start time
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    // Cache the results
    eventsCache = {
      data: allEvents,
      timestamp: Date.now(),
      cacheKey
    }

    return NextResponse.json({
      success: true,
      events: allEvents
    })

  } catch (error) {
    console.error('Calendar events error:', error)

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        error: 'Request timed out'
      })
    }

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch events'
    })
  }
}

/**
 * Gets a valid access token using refresh token
 */
async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
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
      console.error('Token refresh failed:', await response.text())
      return null
    }

    const data = await response.json()
    return data.access_token

  } catch (error) {
    console.error('Error refreshing token:', error)
    return null
  }
}
