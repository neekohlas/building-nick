'use client'

import { useState } from 'react'
import { Clock, ExternalLink, Star, Loader2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity, CATEGORIES, Category, MIND_BODY_COLORS, MindBodyType } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { ActivityDetailModal } from './activity-detail-modal'
import { useActivities } from '@/hooks/use-activities'

interface LibraryViewProps {
  onBack: () => void
}

const FILTERS: { value: 'all' | Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mind_body', label: 'Mind-Body' },
  { value: 'physical', label: 'Physical' },
  { value: 'professional', label: 'Professional' }
]

export function LibraryView({ onBack }: LibraryViewProps) {
  const { getAllActivities, isLoading } = useActivities()
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)

  // Get all activities from Notion-synced data, filter by category if needed
  const allActivities = getAllActivities()
    .filter(a => a.name !== 'Untitled') // Exclude untitled entries
    .filter(a => filter === 'all' || a.category === filter)

  // Sort alphabetically (favorites first, then by name)
  const sortedActivities = [...allActivities].sort((a, b) => {
    // Favorites first
    if (a.favorite && !b.favorite) return -1
    if (!a.favorite && b.favorite) return 1
    // Then alphabetically
    return a.name.localeCompare(b.name)
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading activities...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Activity Library</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {sortedActivities.length} activities available
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List - Alphabetically sorted, flat list */}
      <div className="space-y-3">
        {sortedActivities.map(activity => {
          const activityCategory = CATEGORIES[activity.category]

          // Get category badge color - use mindBodyType gradient for mind_body activities
          const getBadgeColor = () => {
            if (activity.category === 'mind_body' && activity.mindBodyType) {
              return MIND_BODY_COLORS[activity.mindBodyType as MindBodyType]
            }
            return activityCategory.color
          }

          return (
            <button
              key={activity.id}
              onClick={() => setSelectedActivity(activity)}
              className={cn(
                'w-full text-left rounded-xl border bg-card p-4 transition-all',
                'hover:border-muted-foreground/30 hover:shadow-md'
              )}
              style={{
                borderLeftWidth: '4px',
                borderLeftColor: getBadgeColor()
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {activity.favorite && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                    <span className="font-medium text-foreground">
                      {activity.name}
                    </span>
                    {activity.video && (
                      <Play className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {activity.link && (
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {activity.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(activity.duration)}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: getBadgeColor() }}
                    >
                      {activityCategory.name}
                    </span>
                    {activity.quick && (
                      <span className="px-2 py-0.5 rounded-full bg-muted">
                        Quick
                      </span>
                    )}
                    {activity.outdoor && (
                      <span className="px-2 py-0.5 rounded-full bg-muted">
                        Outdoor
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          isCompleted={false}
          onClose={() => setSelectedActivity(null)}
          onComplete={() => setSelectedActivity(null)}
          onSwap={() => {}}
        />
      )}
    </div>
  )
}
