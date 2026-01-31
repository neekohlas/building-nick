'use client'

import { Calendar, MapPin, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@/hooks/use-calendar'

interface CalendarEventCardProps {
  event: CalendarEvent
  compact?: boolean
  formatTime: (event: CalendarEvent) => string
  getDuration: (event: CalendarEvent) => number
}

export function CalendarEventCard({
  event,
  compact = false,
  formatTime,
  getDuration
}: CalendarEventCardProps) {
  const duration = getDuration(event)
  const timeString = formatTime(event)

  // Format duration for display
  const formatDuration = (minutes: number): string => {
    if (minutes >= 24 * 60) return 'All day'
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${minutes}m`
  }

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-3 transition-all',
          'border-blue-200 dark:border-blue-800'
        )}
        style={{ borderLeftWidth: '3px', borderLeftColor: event.color }}
      >
        {/* Calendar icon */}
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: event.color + '20', color: event.color }}
        >
          <Calendar className="h-3.5 w-3.5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-foreground truncate">
            {event.title}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{timeString}</span>
            {event.location && (
              <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                <MapPin className="h-3 w-3 shrink-0" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        {/* Calendar color indicator */}
        <div
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: event.color }}
          title={event.calendarName}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-blue-50 dark:bg-blue-950/30 p-4 transition-all',
        'border-blue-200 dark:border-blue-800'
      )}
      style={{ borderLeftWidth: '4px', borderLeftColor: event.color }}
    >
      {/* Calendar icon */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: event.color + '20', color: event.color }}
      >
        <Calendar className="h-4 w-4" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">
          {event.title}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {timeString}
          </span>
          <span className="text-xs">
            {formatDuration(duration)}
          </span>
          {event.location && (
            <span className="flex items-center gap-1 truncate max-w-[150px]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
        </div>
        {event.calendarName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            {event.calendarName}
          </div>
        )}
      </div>
    </div>
  )
}

// Compact list item for showing in week view previews
export function CalendarEventListItem({
  event,
  formatTime
}: {
  event: CalendarEvent
  formatTime: (event: CalendarEvent) => string
}) {
  return (
    <div className="flex items-center gap-2 text-sm py-1">
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: event.color }}
      />
      <span className="text-muted-foreground text-xs">
        {formatTime(event)}
      </span>
      <span className="truncate text-foreground">
        {event.title}
      </span>
    </div>
  )
}
