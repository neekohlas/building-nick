'use client'

import { useState } from 'react'
import { Clock, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAllActivities, Activity, CATEGORIES, Category } from '@/lib/activities'
import { formatDuration } from '@/lib/date-utils'
import { ActivityDetailModal } from './activity-detail-modal'

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
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)

  const activities = getAllActivities().filter(
    a => filter === 'all' || a.category === filter
  )

  // Group by category when showing all
  const groupedActivities = filter === 'all'
    ? Object.entries(
        activities.reduce((acc, activity) => {
          if (!acc[activity.category]) {
            acc[activity.category] = []
          }
          acc[activity.category].push(activity)
          return acc
        }, {} as Record<Category, Activity[]>)
      )
    : [['filtered', activities] as [string, Activity[]]]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">Activity Library</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {activities.length} activities available
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

      {/* Activity List */}
      <div className="space-y-6">
        {groupedActivities.map(([categoryKey, categoryActivities]) => {
          const category = categoryKey !== 'filtered' ? CATEGORIES[categoryKey as Category] : null

          return (
            <div key={categoryKey} className="space-y-3">
              {category && (
                <h3 
                  className="text-sm font-semibold px-1"
                  style={{ color: category.color }}
                >
                  {category.name}
                </h3>
              )}
              {categoryActivities.map(activity => {
                const activityCategory = CATEGORIES[activity.category]

                return (
                  <button
                    key={activity.id}
                    onClick={() => setSelectedActivity(activity)}
                    className={cn(
                      'w-full text-left rounded-xl border bg-card p-4 transition-all',
                      'hover:border-muted-foreground/30 hover:shadow-md'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {activity.name}
                          </span>
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
                      <div
                        className="h-3 w-3 rounded-full shrink-0 mt-1"
                        style={{ backgroundColor: activityCategory.color }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
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
