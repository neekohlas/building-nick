'use client'

import { Bell, Check, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Reminder } from '@/lib/reminders'

interface ReminderCardProps {
  reminder: Reminder
  isOverdue?: boolean
  onToggleComplete: () => void
}

export function ReminderCard({
  reminder,
  isOverdue = false,
  onToggleComplete
}: ReminderCardProps) {
  // Format time for display
  const formatTime = (): string => {
    if (reminder.isAllDay) return 'All day'

    return reminder.dueDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Format overdue date
  const formatOverdueDate = (): string => {
    return reminder.dueDate.toLocaleDateString([], {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-all',
        reminder.isCompleted
          ? 'bg-muted/30 border-muted opacity-60'
          : isOverdue
            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
            : 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
      )}
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: reminder.isCompleted
          ? 'var(--muted)'
          : isOverdue
            ? 'rgb(239 68 68)'
            : 'rgb(147 51 234)'
      }}
    >
      {/* Completion checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleComplete()
        }}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          reminder.isCompleted
            ? 'border-green-500 bg-green-500 text-white'
            : isOverdue
              ? 'border-red-400 hover:border-red-500'
              : 'border-purple-400 hover:border-purple-500'
        )}
      >
        {reminder.isCompleted && <Check className="h-3.5 w-3.5" />}
      </button>

      {/* Icon */}
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          reminder.isCompleted
            ? 'bg-muted text-muted-foreground'
            : isOverdue
              ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
              : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'
        )}
      >
        {isOverdue ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Bell className="h-3.5 w-3.5" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'font-medium text-sm truncate',
            reminder.isCompleted
              ? 'text-muted-foreground line-through'
              : 'text-foreground'
          )}
        >
          {reminder.title}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {formatTime()}
          </span>
          {isOverdue && (
            <span className="text-red-500 dark:text-red-400 font-medium">
              {formatOverdueDate()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Section header for overdue reminders
 */
export function OverdueRemindersSection({
  reminders,
  onToggleComplete
}: {
  reminders: Reminder[]
  onToggleComplete: (id: string) => void
}) {
  if (reminders.length === 0) return null

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm font-medium text-red-600 dark:text-red-400">
          Overdue ({reminders.length})
        </span>
      </div>
      <div className="space-y-2">
        {reminders.map(reminder => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            isOverdue={true}
            onToggleComplete={() => onToggleComplete(reminder.id)}
          />
        ))}
      </div>
    </div>
  )
}
