'use client'

import { Check, ArrowRightLeft, Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity, CATEGORIES } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'

interface ActivityCardProps {
  activity: Activity
  isCompleted: boolean
  timeBlock: string
  onToggleComplete: () => void
  onSwap: () => void
  onClick: () => void
}

export function ActivityCard({
  activity,
  isCompleted,
  onToggleComplete,
  onSwap,
  onClick
}: ActivityCardProps) {
  const category = CATEGORIES[activity.category]

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-card p-4 transition-all cursor-pointer',
        'hover:border-muted-foreground/30 hover:shadow-md',
        'active:scale-[0.98]',
        isCompleted && 'bg-muted/50 opacity-70'
      )}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleComplete()
        }}
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          isCompleted
            ? 'border-[var(--success)] bg-[var(--success)] text-[var(--success-foreground)]'
            : 'border-border hover:border-primary'
        )}
      >
        {isCompleted && <Check className="h-4 w-4" />}
      </button>

      {/* Info */}
      <div className="flex-1 min-w-0" onClick={onClick}>
        <div className={cn(
          'font-medium text-foreground',
          isCompleted && 'line-through text-muted-foreground'
        )}>
          {activity.name}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(activity.duration)}
          </span>
          {activity.pairs_with && (
            <span className="text-primary text-xs">
              Pairs with workout
            </span>
          )}
          {activity.link && (
            <ExternalLink className="h-3 w-3" />
          )}
        </div>
      </div>

      {/* Category indicator */}
      <div
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: category.color }}
      />

      {/* Swap button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSwap()
        }}
        className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <ArrowRightLeft className="h-5 w-5" />
      </button>
    </div>
  )
}
