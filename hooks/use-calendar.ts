'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TimeBlock } from '@/lib/activities'

export interface Calendar {
  id: string
  name: string
  primary: boolean
  color: string
}

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

interface CalendarAuthStatus {
  connected: boolean
  email?: string
  calendars?: Calendar[]
  error?: string
}

interface CalendarEventsResponse {
  success: boolean
  events?: CalendarEvent[]
  error?: string
  cached?: boolean
}

// LocalStorage keys
const SELECTED_CALENDARS_KEY = 'calendar_selected_ids'
const EVENTS_CACHE_KEY = 'calendar_events_cache'
const EVENTS_CACHE_TIME_KEY = 'calendar_events_cache_time'

// Time block hour ranges for filtering events
const TIME_BLOCK_HOURS: Record<string, { start: number; end: number }> = {
  before6am: { start: 0, end: 6 },
  before9am: { start: 6, end: 9 },
  beforeNoon: { start: 9, end: 12 },
  before230pm: { start: 12, end: 14.5 },
  before5pm: { start: 14.5, end: 17 },
  before9pm: { start: 17, end: 21 },
  // Legacy/alternative time block names
  before12pm: { start: 9, end: 12 },
  before3pm: { start: 12, end: 15 },
  before6pm: { start: 15, end: 18 },
  before12am: { start: 21, end: 24 }
}

// Cache events in localStorage (client-side cache)
function getCachedEvents(): CalendarEvent[] | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(EVENTS_CACHE_KEY)
    const cacheTime = localStorage.getItem(EVENTS_CACHE_TIME_KEY)
    if (cached && cacheTime) {
      // Cache valid for 15 minutes
      if (Date.now() - parseInt(cacheTime) < 15 * 60 * 1000) {
        return JSON.parse(cached)
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

function setCachedEvents(events: CalendarEvent[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events))
    localStorage.setItem(EVENTS_CACHE_TIME_KEY, Date.now().toString())
  } catch {
    // Ignore storage errors
  }
}

function clearCachedEvents(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(EVENTS_CACHE_KEY)
    localStorage.removeItem(EVENTS_CACHE_TIME_KEY)
  } catch {
    // Ignore errors
  }
}

// Get selected calendar IDs from localStorage
function getSelectedCalendarIds(): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(SELECTED_CALENDARS_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // Ignore errors
  }
  return null
}

function setSelectedCalendarIds(ids: string[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SELECTED_CALENDARS_KEY, JSON.stringify(ids))
  } catch {
    // Ignore errors
  }
}

export function useCalendar() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [selectedCalendarIds, setSelectedCalendarIdsState] = useState<string[]>([])
  const [events, setEvents] = useState<CalendarEvent[]>([])

  // Check connection status and fetch calendars
  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/google/status')
      const data: CalendarAuthStatus = await response.json()

      setIsConnected(data.connected)
      setEmail(data.email || null)
      setCalendars(data.calendars || [])

      if (data.connected && data.calendars) {
        // Initialize selected calendars if not set
        const savedSelection = getSelectedCalendarIds()
        if (savedSelection && savedSelection.length > 0) {
          // Filter to only include calendars that still exist
          const validIds = savedSelection.filter(id =>
            data.calendars!.some(c => c.id === id)
          )
          setSelectedCalendarIdsState(validIds.length > 0 ? validIds : data.calendars.map(c => c.id))
        } else {
          // Default to all calendars
          setSelectedCalendarIdsState(data.calendars.map(c => c.id))
        }
      }

      if (data.error) {
        setError(data.error)
      }
    } catch (err) {
      console.error('Failed to check calendar status:', err)
      setError('Failed to check connection status')
    }
  }, [])

  // Fetch events for a date range
  const fetchEvents = useCallback(async (start: string, end: string, calendarIds?: string[]) => {
    if (!isConnected) return

    setIsLoading(true)
    setError(null)

    try {
      // Try client cache first
      const cached = getCachedEvents()
      if (cached) {
        setEvents(cached)
        setIsLoading(false)
        // Still refresh in background
      }

      const params = new URLSearchParams({ start, end })
      if (calendarIds && calendarIds.length > 0) {
        params.set('calendarIds', calendarIds.join(','))
      }

      const response = await fetch(`/api/calendar/events?${params.toString()}`)
      const data: CalendarEventsResponse = await response.json()

      if (data.success && data.events) {
        setEvents(data.events)
        setCachedEvents(data.events)
      } else if (data.error === 'not_connected') {
        setIsConnected(false)
        setEvents([])
      } else {
        setError(data.error || 'Failed to fetch events')
      }
    } catch (err) {
      console.error('Failed to fetch calendar events:', err)
      setError('Failed to fetch events')
    } finally {
      setIsLoading(false)
    }
  }, [isConnected])

  // Initial load - check status and fetch events
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      await checkStatus()
      setIsLoading(false)
    }
    init()
  }, [checkStatus])

  // Fetch events when connected and calendars are selected
  useEffect(() => {
    if (isConnected && selectedCalendarIds.length > 0) {
      // Fetch events for current week + next 7 days
      const today = new Date()
      const start = new Date(today)
      start.setDate(start.getDate() - start.getDay()) // Start of current week
      const end = new Date(today)
      end.setDate(end.getDate() + 14) // 2 weeks ahead

      const startStr = start.toISOString().split('T')[0]
      const endStr = end.toISOString().split('T')[0]

      fetchEvents(startStr, endStr, selectedCalendarIds)
    }
  }, [isConnected, selectedCalendarIds, fetchEvents])

  // Connect - redirect to OAuth flow
  const connect = useCallback(() => {
    window.location.href = '/api/auth/google'
  }, [])

  // Disconnect - revoke and clear
  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/auth/google/disconnect', { method: 'POST' })
      setIsConnected(false)
      setEmail(null)
      setCalendars([])
      setSelectedCalendarIdsState([])
      setEvents([])
      clearCachedEvents()
      localStorage.removeItem(SELECTED_CALENDARS_KEY)
    } catch (err) {
      console.error('Failed to disconnect:', err)
      setError('Failed to disconnect')
    }
  }, [])

  // Update selected calendars
  const setSelectedCalendars = useCallback((ids: string[]) => {
    setSelectedCalendarIdsState(ids)
    setSelectedCalendarIds(ids)
    // Clear cache to force refresh with new calendars
    clearCachedEvents()
  }, [])

  // Refetch events
  const refetch = useCallback(async () => {
    clearCachedEvents()
    if (isConnected && selectedCalendarIds.length > 0) {
      const today = new Date()
      const start = new Date(today)
      start.setDate(start.getDate() - start.getDay())
      const end = new Date(today)
      end.setDate(end.getDate() + 14)

      await fetchEvents(
        start.toISOString().split('T')[0],
        end.toISOString().split('T')[0],
        selectedCalendarIds
      )
    }
  }, [isConnected, selectedCalendarIds, fetchEvents])

  // Get events for a specific date
  const getEventsForDate = useCallback((dateStr: string): CalendarEvent[] => {
    return events.filter(event => {
      const eventDate = event.start.split('T')[0]
      // For all-day events, check if the date matches
      if (event.allDay) {
        const eventEndDate = event.end.split('T')[0]
        return dateStr >= eventDate && dateStr < eventEndDate
      }
      return eventDate === dateStr
    })
  }, [events])

  // Get events for a specific time block on a date
  // Events are placed based on their START time falling within the block's range
  const getEventsForTimeBlock = useCallback((dateStr: string, timeBlock: TimeBlock): CalendarEvent[] => {
    const blockHours = TIME_BLOCK_HOURS[timeBlock]
    if (!blockHours) return []

    return events.filter(event => {
      // Check if event is on this date
      const eventStartDate = event.start.split('T')[0]

      // All-day events only appear in the first time block (before6am)
      if (event.allDay) {
        if (timeBlock !== 'before6am') return false
        const eventEndDate = event.end.split('T')[0]
        return dateStr >= eventStartDate && dateStr < eventEndDate
      }

      if (eventStartDate !== dateStr) return false

      // Place event based on its START time
      const eventStart = new Date(event.start)
      const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60

      // Event belongs to this block if its start time falls within the block's range
      return eventStartHour >= blockHours.start && eventStartHour < blockHours.end
    })
  }, [events])

  // Check if a time block has any calendar events (potential conflicts)
  const hasConflict = useCallback((dateStr: string, timeBlock: TimeBlock): boolean => {
    return getEventsForTimeBlock(dateStr, timeBlock).length > 0
  }, [getEventsForTimeBlock])

  // Format event time for display
  const formatEventTime = useCallback((event: CalendarEvent): string => {
    if (event.allDay) return 'All day'

    const start = new Date(event.start)
    const end = new Date(event.end)

    const formatTime = (date: Date) => {
      const hours = date.getHours()
      const minutes = date.getMinutes()
      const ampm = hours >= 12 ? 'pm' : 'am'
      const hour12 = hours % 12 || 12
      return minutes ? `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}` : `${hour12}${ampm}`
    }

    return `${formatTime(start)} - ${formatTime(end)}`
  }, [])

  // Calculate event duration in minutes
  const getEventDuration = useCallback((event: CalendarEvent): number => {
    if (event.allDay) return 24 * 60

    const start = new Date(event.start)
    const end = new Date(event.end)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }, [])

  return {
    // Connection status
    isConnected,
    isLoading,
    error,
    email,

    // Calendars
    calendars,
    selectedCalendarIds,
    setSelectedCalendars,

    // Events
    events,

    // Actions
    connect,
    disconnect,
    refetch,

    // Helpers
    getEventsForDate,
    getEventsForTimeBlock,
    hasConflict,
    formatEventTime,
    getEventDuration
  }
}
