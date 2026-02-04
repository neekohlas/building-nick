'use client'

import { Check, Clock, ExternalLink, MoreVertical, ArrowRightLeft, CalendarClock, Video, Volume2, GripVertical, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity, CATEGORIES } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { SpectrumBar } from './spectrum-bar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ActivityCardProps {
  activity: Activity
  isCompleted: boolean
  timeBlock: string
  onToggleComplete: () => void
  onSwap: () => void
  onPush: () => void
  onClick: () => void
  onReorder?: () => void
  onDelete?: () => void
}

export function ActivityCard({
  activity,
  isCompleted,
  onToggleComplete,
  onSwap,
  onPush,
  onClick,
  onReorder,
  onDelete
}: ActivityCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card overflow-hidden transition-all cursor-pointer',
        'hover:border-muted-foreground/30 hover:shadow-sm',
        'active:scale-[0.99]',
        isCompleted && 'bg-muted/50 opacity-70'
      )}
      onClick={onClick}
    >
      {/* Spectrum bar at top */}
      {activity.spectrum && (
        <SpectrumBar spectrum={activity.spectrum} size="sm" />
      )}

      <div className="flex items-center gap-4 p-3">
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
      <div className="flex-1 min-w-0">
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
          {activity.pairsWith && (
            <span className="text-primary text-xs">
              Pairs with workout
            </span>
          )}
          {activity.video && (
            <Video className="h-3 w-3" title="Has video" />
          )}
          {!activity.video && activity.link && (
            <ExternalLink className="h-3 w-3" title="External link" />
          )}
          {activity.voiceGuided && (
            <Volume2 className="h-3 w-3" title="Audio guide available" />
          )}
        </div>
      </div>

        {/* Actions menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSwap(); }}>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Swap Activity
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPush(); }}>
              <CalendarClock className="h-4 w-4 mr-2" />
              Push to Tomorrow
            </DropdownMenuItem>
            {onReorder && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReorder(); }}>
                <GripVertical className="h-4 w-4 mr-2" />
                Reorder
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove from Today
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
