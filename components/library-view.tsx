'use client'

import { useState } from 'react'
import { Clock, ExternalLink, Star, Loader2, Video, Volume2, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Activity, CATEGORIES, Category, hasVideo } from '@/lib/activities'
import { formatDuration, formatDateISO } from '@/lib/date-utils'
import { ActivityDetailModal } from './activity-detail-modal'
import { SpectrumBar } from './spectrum-bar'
import { useActivities } from '@/hooks/use-activities'
import { useStorage, TimeBlock } from '@/hooks/use-storage'
import { TIME_BLOCKS, BLOCK_LABELS } from '@/lib/notifications'
import { Button } from '@/components/ui/button'

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
  const storage = useStorage()
  const [filter, setFilter] = useState<'all' | Category>('all')
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [showTimeSlotPicker, setShowTimeSlotPicker] = useState(false)
  const [activityToAdd, setActivityToAdd] = useState<Activity | null>(null)
  const [addedMessage, setAddedMessage] = useState<string | null>(null)

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

  const handleAddToToday = () => {
    if (selectedActivity) {
      setActivityToAdd(selectedActivity)
      setShowTimeSlotPicker(true)
      setSelectedActivity(null)
    }
  }

  const handleSelectTimeSlot = async (timeBlock: TimeBlock) => {
    if (!activityToAdd || !storage.isReady) return

    const today = formatDateISO(new Date())

    // Get current schedule for today
    let schedule = await storage.getDailySchedule(today)

    if (!schedule) {
      // Create new schedule with empty time blocks
      schedule = {
        date: today,
        activities: {
          before6am: [],
          before9am: [],
          beforeNoon: [],
          before230pm: [],
          before5pm: [],
          before9pm: []
        }
      }
    }

    // Add activity to selected time block if not already there
    if (!schedule.activities[timeBlock].includes(activityToAdd.id)) {
      schedule.activities[timeBlock].push(activityToAdd.id)
      await storage.saveDailySchedule(schedule)
    }

    // Show success message
    setAddedMessage(`Added "${activityToAdd.name}" to ${BLOCK_LABELS[timeBlock]}`)
    setTimeout(() => setAddedMessage(null), 3000)

    // Close picker
    setShowTimeSlotPicker(false)
    setActivityToAdd(null)
  }

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
      {/* Success Message Toast */}
      {addedMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Check className="h-4 w-4" />
          {addedMessage}
        </div>
      )}

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

          return (
            <button
              key={activity.id}
              onClick={() => setSelectedActivity(activity)}
              className={cn(
                'w-full text-left rounded-lg border bg-card overflow-hidden transition-all',
                'hover:border-muted-foreground/30 hover:shadow-sm'
              )}
            >
              {/* Spectrum bar at top */}
              {activity.spectrum && (
                <SpectrumBar spectrum={activity.spectrum} size="sm" />
              )}

              <div className="p-4">
                <div className="flex items-center gap-2">
                  {activity.favorite && (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                  <span className="font-medium text-foreground">
                    {activity.name}
                  </span>
                  {hasVideo(activity) && (
                    <Video className="h-3.5 w-3.5 text-muted-foreground" title="Has video" />
                  )}
                  {!hasVideo(activity) && activity.link && (
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" title="External link" />
                  )}
                  {activity.voiceGuided && (
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" title="Audio guide available" />
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
                  <span>{activityCategory.name}</span>
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
          onAddToToday={handleAddToToday}
          mode="library"
        />
      )}

      {/* Time Slot Picker Modal */}
      {showTimeSlotPicker && activityToAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => {
            setShowTimeSlotPicker(false)
            setActivityToAdd(null)
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Select Time Slot</h3>
              <button
                onClick={() => {
                  setShowTimeSlotPicker(false)
                  setActivityToAdd(null)
                }}
                className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add "{activityToAdd.name}" to today's schedule:
            </p>
            <div className="space-y-2">
              {TIME_BLOCKS.map(block => (
                <Button
                  key={block}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleSelectTimeSlot(block)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {BLOCK_LABELS[block]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
