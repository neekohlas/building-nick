'use client'

import { Check, Clock, ExternalLink, MoreVertical, ArrowRightLeft, CalendarClock, Video, Volume2, GripVertical, Trash2, Activity as ActivityIcon, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity, CATEGORIES, hasVideo } from '@/lib/activities'
import { formatDuration, formatTimeRange } from '@/lib/date-utils'
import { SpectrumBar } from './spectrum-bar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function formatDistance(meters: number): string {
  const km = meters / 1000
  if (km >= 1) return `${km.toFixed(1)} km`
  return `${Math.round(meters)} m`
}

function formatCalories(cal: number): string {
  return `${Math.round(cal)} cal`
}

interface ActivityCardProps {
  activity: Activity
  isCompleted: boolean
  timeBlock: string
  customDuration?: number  // User-overridden duration (from completion or edit)
  onToggleComplete: () => void
  onSwap?: () => void
  onPush?: () => void
  onClick: () => void
  onReorder?: () => void
  onDelete?: () => void
  // Strava import metadata
  stravaName?: string
  stravaDistance?: number
  stravaSportType?: string
  stravaCalories?: number
  stravaAvgHeartrate?: number
  stravaStartTime?: string
  stravaElapsedSeconds?: number
}

export function ActivityCard({
  activity,
  isCompleted,
  customDuration,
  onToggleComplete,
  onSwap,
  onPush,
  onClick,
  onReorder,
  onDelete,
  stravaName,
  stravaDistance,
  stravaSportType,
  stravaCalories,
  stravaAvgHeartrate,
  stravaStartTime,
  stravaElapsedSeconds,
}: ActivityCardProps) {
  const displayDuration = customDuration ?? activity.duration
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
        {/* Strava activity name subtitle */}
        {stravaName && (
          <div className="flex items-center gap-1 text-xs text-orange-500 mt-0.5">
            <ActivityIcon className="h-3 w-3" />
            <span className="truncate">{stravaName}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(displayDuration)}
          </span>
          {stravaStartTime && stravaElapsedSeconds && (
            <span className="text-xs">{formatTimeRange(stravaStartTime, stravaElapsedSeconds)}</span>
          )}
          {stravaDistance != null && stravaDistance > 0 && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {formatDistance(stravaDistance)}
            </span>
          )}
          {stravaCalories != null && stravaCalories > 0 && (
            <span className="text-xs">{formatCalories(stravaCalories)}</span>
          )}
          {stravaAvgHeartrate != null && stravaAvgHeartrate > 0 && (
            <span className="text-xs">♥ {Math.round(stravaAvgHeartrate)} bpm</span>
          )}
          {!stravaName && activity.pairsWith && (
            <span className="text-primary text-xs">
              Pairs with workout
            </span>
          )}
          {!stravaName && hasVideo(activity) && (
            <Video className="h-3 w-3" title="Has video" />
          )}
          {!stravaName && !hasVideo(activity) && activity.link && (
            <ExternalLink className="h-3 w-3" title="External link" />
          )}
          {!stravaName && activity.voiceGuided && (
            <Volume2 className="h-3 w-3" title="Audio guide available" />
          )}
        </div>
      </div>

        {/* Actions menu - only show if there are menu items */}
        {(onSwap || onPush || onReorder || onDelete) && (
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
              {onSwap && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSwap(); }}>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Swap Activity
                </DropdownMenuItem>
              )}
              {onPush && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPush(); }}>
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Push to Tomorrow
                </DropdownMenuItem>
              )}
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
                  Remove
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
