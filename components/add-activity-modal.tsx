'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Clock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity, CATEGORIES, Category, TimeBlock } from '@/lib/activities'
import { formatDuration, formatDateShort } from '@/lib/date-utils'
import { useActivities } from '@/hooks/use-activities'
import { SpectrumBar } from './spectrum-bar'

interface AddActivityModalProps {
  targetDate: Date
  defaultTimeBlock?: TimeBlock | null  // Pre-select this time block when opening
  onClose: () => void
  onAdd: (activityId: string, timeBlock: TimeBlock) => void
}

const FILTERS: { value: 'all' | Category; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'mind_body', label: 'Mind-Body' },
  { value: 'physical', label: 'Physical' },
  { value: 'professional', label: 'Professional' }
]

const TIME_BLOCKS: { value: TimeBlock; label: string }[] = [
  { value: 'before6am', label: 'Before 6 AM' },
  { value: 'before9am', label: '6-9 AM' },
  { value: 'beforeNoon', label: '9 AM-12 PM' },
  { value: 'before230pm', label: '12-2:30 PM' },
  { value: 'before5pm', label: '2:30-5 PM' },
  { value: 'before9pm', label: '5-9 PM' }
]

export function AddActivityModal({ targetDate, defaultTimeBlock, onClose, onAdd }: AddActivityModalProps) {
  const { getAllActivities } = useActivities()
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock>(defaultTimeBlock || 'before9pm')
  const searchRef = useRef<HTMLInputElement>(null)

  // Update selected time block when defaultTimeBlock prop changes (e.g., when modal opens with a specific block)
  useEffect(() => {
    if (defaultTimeBlock) {
      setSelectedTimeBlock(defaultTimeBlock)
    }
  }, [defaultTimeBlock])

  // When selecting an activity, keep the user's time block choice
  // (defaultTimeBlock from Notion is only used in 7-day planning, not here)
  const handleSelectActivity = (activity: Activity) => {
    setSelectedActivity(activity)
  }

  // Get activities from Notion (via useActivities hook) and filter
  const allActivities = getAllActivities()
  const activities = allActivities
    .filter(a => filter === 'all' || a.category === filter)
    .filter(a => a.name !== 'Untitled') // Exclude empty entries
    .filter(a => !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Sort by sortOrder if available, then by name
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
        return a.sortOrder - b.sortOrder
      }
      if (a.sortOrder !== undefined) return -1
      if (b.sortOrder !== undefined) return 1
      return a.name.localeCompare(b.name)
    })

  const handleAdd = () => {
    if (selectedActivity) {
      onAdd(selectedActivity.id, selectedTimeBlock)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[65vh] overflow-hidden rounded-2xl bg-card animate-in fade-in zoom-in-95 duration-200 flex flex-col"
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

          {/* Search */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchRef.current?.focus() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
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
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {activities.map(activity => {
            const isSelected = selectedActivity?.id === activity.id

            return (
              <button
                key={activity.id}
                onClick={() => handleSelectActivity(activity)}
                className={cn(
                  'w-full text-left rounded-xl border overflow-hidden transition-all',
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-muted-foreground/30'
                )}
              >
                {/* Spectrum bar at top */}
                {activity.spectrum && (
                  <SpectrumBar spectrum={activity.spectrum} size="sm" />
                )}
                <div className="p-4">
                  <div className="font-medium">{activity.name}</div>
                  <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(activity.duration)}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Time Block Selection & Add Button */}
        {selectedActivity && (
          <div className="sticky bottom-0 border-t bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-muted-foreground">When:</span>
              <select
                value={selectedTimeBlock}
                onChange={(e) => setSelectedTimeBlock(e.target.value as TimeBlock)}
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm font-medium"
              >
                {TIME_BLOCKS.map(tb => (
                  <option key={tb.value} value={tb.value}>{tb.label}</option>
                ))}
              </select>
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
