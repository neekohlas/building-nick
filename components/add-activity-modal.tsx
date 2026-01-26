'use client'

import { useState } from 'react'
import { X, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAllActivities, Activity, CATEGORIES, Category } from '@/lib/activities'
import { formatDuration, formatDateShort } from '@/lib/date-utils'

interface AddActivityModalProps {
  targetDate: Date
  onClose: () => void
  onAdd: (activityId: string, timeBlock: 'before9am' | 'beforeNoon' | 'anytime') => void
}

const FILTERS: { value: 'all' | Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mind_body', label: 'Mind-Body' },
  { value: 'physical', label: 'Physical' },
  { value: 'mindfulness', label: 'Mindfulness' },
  { value: 'professional', label: 'Professional' }
]

const TIME_BLOCKS: { value: 'before9am' | 'beforeNoon' | 'anytime'; label: string }[] = [
  { value: 'before9am', label: 'Before 9 AM' },
  { value: 'beforeNoon', label: 'Before Noon' },
  { value: 'anytime', label: 'Anytime' }
]

export function AddActivityModal({ targetDate, onClose, onAdd }: AddActivityModalProps) {
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<'before9am' | 'beforeNoon' | 'anytime'>('anytime')

  const activities = getAllActivities().filter(
    a => filter === 'all' || a.category === filter
  )

  const handleAdd = () => {
    if (selectedActivity) {
      onAdd(selectedActivity.id, selectedTimeBlock)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">Add Activity</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            For {formatDateShort(targetDate)}
          </p>

          {/* Filters */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
            {FILTERS.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  filter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Activity List */}
        <div className="p-4 space-y-2">
          {activities.map(activity => {
            const category = CATEGORIES[activity.category]
            const isSelected = selectedActivity?.id === activity.id

            return (
              <button
                key={activity.id}
                onClick={() => setSelectedActivity(activity)}
                className={cn(
                  'w-full text-left rounded-xl border p-4 transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{activity.name}</span>
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                </div>
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(activity.duration)}
                </div>
              </button>
            )
          })}
        </div>

        {/* Time Block Selection & Add Button */}
        {selectedActivity && (
          <div className="sticky bottom-0 border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <p className="text-sm font-medium mb-3">Schedule for:</p>
            <div className="flex gap-2 mb-4">
              {TIME_BLOCKS.map(tb => (
                <button
                  key={tb.value}
                  onClick={() => setSelectedTimeBlock(tb.value)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedTimeBlock === tb.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleAdd}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Add {selectedActivity.name}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
