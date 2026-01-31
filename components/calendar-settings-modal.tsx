'use client'

import { useState } from 'react'
import { X, Calendar, RefreshCw, LogOut, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Calendar as CalendarType } from '@/hooks/use-calendar'

interface CalendarSettingsModalProps {
  email: string | null
  calendars: CalendarType[]
  selectedCalendarIds: string[]
  onClose: () => void
  onDisconnect: () => Promise<void>
  onRefresh: () => Promise<void>
  onSetSelectedCalendars: (ids: string[]) => void
}

export function CalendarSettingsModal({
  email,
  calendars,
  selectedCalendarIds,
  onClose,
  onDisconnect,
  onRefresh,
  onSetSelectedCalendars
}: CalendarSettingsModalProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    try {
      await onDisconnect()
      onClose()
    } finally {
      setIsDisconnecting(false)
    }
  }

  const toggleCalendar = (calendarId: string) => {
    const newSelection = selectedCalendarIds.includes(calendarId)
      ? selectedCalendarIds.filter(id => id !== calendarId)
      : [...selectedCalendarIds, calendarId]

    // Ensure at least one calendar is selected
    if (newSelection.length > 0) {
      onSetSelectedCalendars(newSelection)
    }
  }

  const selectAll = () => {
    onSetSelectedCalendars(calendars.map(c => c.id))
  }

  const selectNone = () => {
    // Keep at least the primary calendar
    const primary = calendars.find(c => c.primary)
    if (primary) {
      onSetSelectedCalendars([primary.id])
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Calendar Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Connected Account */}
          {email && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-muted-foreground mb-1">Connected account</p>
              <p className="font-medium text-sm">{email}</p>
            </div>
          )}

          {/* Calendars Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Calendars to display</label>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-primary hover:underline"
                >
                  All
                </button>
                <span className="text-muted-foreground">|</span>
                <button
                  onClick={selectNone}
                  className="text-xs text-primary hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {calendars.map((calendar) => (
                <button
                  key={calendar.id}
                  onClick={() => toggleCalendar(calendar.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                    'hover:bg-muted',
                    selectedCalendarIds.includes(calendar.id) && 'bg-muted/50'
                  )}
                >
                  {/* Checkbox */}
                  <div
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all',
                      selectedCalendarIds.includes(calendar.id)
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-border'
                    )}
                  >
                    {selectedCalendarIds.includes(calendar.id) && (
                      <Check className="h-3 w-3" />
                    )}
                  </div>

                  {/* Calendar info */}
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <span className="flex-1 truncate text-sm">
                    {calendar.name}
                    {calendar.primary && (
                      <span className="text-xs text-muted-foreground ml-1">(Primary)</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {calendars.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No calendars found
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 border-t space-y-2">
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh Events
            </Button>

            {!showDisconnectConfirm ? (
              <Button
                variant="outline"
                className="w-full bg-transparent text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect Calendar
              </Button>
            ) : (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                <p className="text-sm text-center">
                  Are you sure you want to disconnect?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                  >
                    {isDisconnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Disconnect'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
