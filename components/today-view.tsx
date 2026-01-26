'use client'

import { useEffect, useState, useCallback } from 'react'
import { ActivityCard } from './activity-card'
import { ActivityDetailModal } from './activity-detail-modal'
import { SwapModal } from './swap-modal'
import { PushModal } from './push-modal'
import { Celebration } from './celebration'
import { Button } from '@/components/ui/button'
import { CalendarClock } from 'lucide-react'
import {
  Activity,
  ACTIVITIES,
  getQuickMindBodyActivities,
  getOutdoorPhysicalActivities
} from '@/lib/activities'
import { formatDateISO, shouldShowProfessionalGoals } from '@/lib/date-utils'
import { getRandomMessage, getStreakMessage, pickRandom } from '@/lib/messages'
import { useStorage, DailySchedule } from '@/hooks/use-storage'

interface TodayViewProps {
  onOpenMenu: () => void
}

type TimeBlock = 'before9am' | 'beforeNoon' | 'anytime'

const TIME_BLOCK_LABELS: Record<TimeBlock, string> = {
  before9am: 'Before 9 AM',
  beforeNoon: 'Before Noon',
  anytime: 'Anytime Today'
}

export function TodayView({ onOpenMenu }: TodayViewProps) {
  const storage = useStorage()
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [motivation, setMotivation] = useState('')
  const [streak, setStreak] = useState(0)

  // Modal states
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock | null>(null)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapActivity, setSwapActivity] = useState<Activity | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showPushModal, setShowPushModal] = useState(false)
  const [pushActivity, setPushActivity] = useState<Activity | null>(null)

  const today = new Date()
  const dateStr = formatDateISO(today)

  // Generate daily schedule
  const generateSchedule = useCallback((): DailySchedule => {
    const isProfessionalDay = shouldShowProfessionalGoals(today)

    const newSchedule: DailySchedule = {
      date: dateStr,
      activities: {
        before9am: [],
        beforeNoon: [],
        anytime: []
      }
    }

    // Before 9 AM: Mind-body practice + job follow-up (if weekday)
    const quickActivities = getQuickMindBodyActivities()
    const picked = pickRandom(quickActivities)
    newSchedule.activities.before9am.push(picked.id)

    if (isProfessionalDay) {
      newSchedule.activities.before9am.push('job_followup')
    }

    // Before Noon: Physical exercise + education
    newSchedule.activities.beforeNoon.push('biking')
    newSchedule.activities.beforeNoon.push('dumbbell_presses')

    if (isProfessionalDay) {
      newSchedule.activities.beforeNoon.push('coursera_module')
    }

    // Anytime: Mindfulness + job search (if weekday)
    newSchedule.activities.anytime.push('lin_health_activity')

    if (isProfessionalDay) {
      newSchedule.activities.anytime.push('job_search')
    }

    return newSchedule
  }, [today, dateStr])

  // Load data - only run once when storage becomes ready
  useEffect(() => {
    if (!storage.isReady) return

    let hasLoaded = false

    async function loadData() {
      if (hasLoaded) return
      hasLoaded = true

      // Get or generate schedule
      let existingSchedule = await storage.getDailySchedule(dateStr)

      if (!existingSchedule) {
        existingSchedule = generateSchedule()
        await storage.saveDailySchedule(existingSchedule)
      }

      setSchedule(existingSchedule)

      // Get completions
      const completions = await storage.getCompletionsForDate(dateStr)
      setCompletedIds(new Set(completions.map(c => c.activityId)))

      // Get streak and stats
      const currentStreak = await storage.getCurrentStreak()
      setStreak(currentStreak)

      const stats = await storage.getCompletionStats(7)

      // Set motivation message only if not already set
      setMotivation(prev => {
        if (prev) return prev // Don't change if already set
        
        if (stats.daysWithActivity >= 5) {
          if (currentStreak > 1) {
            return getStreakMessage(currentStreak)
          }
          return getRandomMessage('morning')
        } else if (stats.daysWithActivity > 0) {
          return Math.random() < 0.3 ? getRandomMessage('countdown') : getRandomMessage('reengagement')
        }
        return getRandomMessage('countdown')
      })
    }

    loadData()
  }, [storage.isReady, dateStr, generateSchedule])

  // Toggle completion
  const handleToggleComplete = async (activityId: string, timeBlock: TimeBlock) => {
    if (!storage.isReady) return

    const isCompleted = completedIds.has(activityId)

    if (isCompleted) {
      await storage.removeCompletion(dateStr, activityId)
      setCompletedIds(prev => {
        const next = new Set(prev)
        next.delete(activityId)
        return next
      })
    } else {
      await storage.saveCompletion({
        date: dateStr,
        activityId,
        timeBlock
      })
      setCompletedIds(prev => new Set([...prev, activityId]))
      setShowCelebration(true)

      // Update streak
      const newStreak = await storage.getCurrentStreak()
      setStreak(newStreak)
    }
  }

  // Swap activity
  const handleSwap = async (newActivityId: string) => {
    if (!schedule || !swapActivity || !selectedTimeBlock) return

    const newSchedule: DailySchedule = {
      ...schedule,
      activities: {
        ...schedule.activities,
        [selectedTimeBlock]: schedule.activities[selectedTimeBlock].map(id =>
          id === swapActivity.id ? newActivityId : id
        )
      }
    }

    await storage.saveDailySchedule(newSchedule)
    setSchedule(newSchedule)
    setShowSwapModal(false)
    setSwapActivity(null)
  }

  // Get tomorrow's date string
  const getTomorrowDateStr = () => {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  // Push single activity to tomorrow
  const handlePushSingle = async () => {
    if (!schedule || !pushActivity) return

    const tomorrowStr = getTomorrowDateStr()
    
    // Find which time block the activity is in
    let activityTimeBlock: TimeBlock | null = null
    for (const block of Object.keys(schedule.activities) as TimeBlock[]) {
      if (schedule.activities[block].includes(pushActivity.id)) {
        activityTimeBlock = block
        break
      }
    }
    if (!activityTimeBlock) return

    // Remove from today
    const newTodaySchedule: DailySchedule = {
      ...schedule,
      activities: {
        ...schedule.activities,
        [activityTimeBlock]: schedule.activities[activityTimeBlock].filter(
          id => id !== pushActivity.id
        )
      }
    }
    await storage.saveDailySchedule(newTodaySchedule)
    setSchedule(newTodaySchedule)

    // Add to tomorrow
    let tomorrowSchedule = await storage.getDailySchedule(tomorrowStr)
    if (!tomorrowSchedule) {
      tomorrowSchedule = {
        date: tomorrowStr,
        activities: { before9am: [], beforeNoon: [], anytime: [] }
      }
    }
    tomorrowSchedule.activities[activityTimeBlock] = [
      ...tomorrowSchedule.activities[activityTimeBlock],
      pushActivity.id
    ]
    await storage.saveDailySchedule(tomorrowSchedule)

    setShowPushModal(false)
    setPushActivity(null)
  }

  // Push all incomplete activities to tomorrow
  const handlePushAllIncomplete = async () => {
    if (!schedule) return

    const tomorrowStr = getTomorrowDateStr()
    
    // Get or create tomorrow's schedule
    let tomorrowSchedule = await storage.getDailySchedule(tomorrowStr)
    if (!tomorrowSchedule) {
      tomorrowSchedule = {
        date: tomorrowStr,
        activities: { before9am: [], beforeNoon: [], anytime: [] }
      }
    }

    // Build new schedules
    const newTodayActivities: DailySchedule['activities'] = {
      before9am: [],
      beforeNoon: [],
      anytime: []
    }

    for (const block of Object.keys(schedule.activities) as TimeBlock[]) {
      for (const activityId of schedule.activities[block]) {
        if (completedIds.has(activityId)) {
          // Keep completed activities in today
          newTodayActivities[block].push(activityId)
        } else {
          // Move incomplete to tomorrow
          tomorrowSchedule.activities[block] = [
            ...tomorrowSchedule.activities[block],
            activityId
          ]
        }
      }
    }

    // Save both schedules
    const newTodaySchedule: DailySchedule = {
      ...schedule,
      activities: newTodayActivities
    }
    await storage.saveDailySchedule(newTodaySchedule)
    await storage.saveDailySchedule(tomorrowSchedule)
    
    setSchedule(newTodaySchedule)
    setShowPushModal(false)
    setPushActivity(null)
  }

  // Calculate incomplete count
  const incompleteActivities = schedule
    ? Object.values(schedule.activities).flat().filter(id => !completedIds.has(id))
    : []

  // Calculate progress
  const totalActivities = schedule
    ? Object.values(schedule.activities).flat().length
    : 0
  const completedCount = completedIds.size

  if (!schedule) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your plan...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Motivation Card */}
      <div className="rounded-2xl border-l-4 border-l-[var(--accent)] bg-card p-6 shadow-sm">
        <p className="text-lg font-medium leading-relaxed text-foreground font-sans" suppressHydrationWarning>
          {motivation || '\u00A0'}
        </p>
      </div>

      {/* Daily Plan */}
      <div className="space-y-6">
        {(Object.keys(TIME_BLOCK_LABELS) as TimeBlock[]).map(block => {
          const activities = schedule.activities[block]
          if (activities.length === 0) return null

          return (
            <div key={block} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                {TIME_BLOCK_LABELS[block]}
              </h3>
              {activities.map(activityId => {
                const activity = ACTIVITIES[activityId]
                if (!activity) return null

                return (
                  <ActivityCard
                    key={activityId}
                    activity={activity}
                    isCompleted={completedIds.has(activityId)}
                    timeBlock={block}
                    onToggleComplete={() => handleToggleComplete(activityId, block)}
                    onSwap={() => {
                      setSwapActivity(activity)
                      setSelectedTimeBlock(block)
                      setShowSwapModal(true)
                    }}
                    onPush={() => {
                      setPushActivity(activity)
                      setShowPushModal(true)
                    }}
                    onClick={() => {
                      setSelectedActivity(activity)
                      setSelectedTimeBlock(block)
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Push All Incomplete Button */}
      {incompleteActivities.length > 1 && (
        <Button
          variant="outline"
          className="w-full bg-transparent"
          onClick={() => {
            setPushActivity(null)
            setShowPushModal(true)
          }}
        >
          <CalendarClock className="h-4 w-4 mr-2" />
          Push {incompleteActivities.length} Incomplete to Tomorrow
        </Button>
      )}

      {/* Progress Section */}
      <div className="rounded-2xl bg-card p-6 shadow-sm">
        <div className="flex justify-around">
          <div className="text-center">
            <span className="block text-3xl font-bold text-primary">
              {completedCount}/{totalActivities}
            </span>
            <span className="text-sm text-muted-foreground mt-1">Today</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl font-bold text-primary">
              {streak}
            </span>
            <span className="text-sm text-muted-foreground mt-1">Day Streak</span>
          </div>
        </div>
      </div>

      {/* Activity Detail Modal */}
      {selectedActivity && !showSwapModal && (
        <ActivityDetailModal
          activity={selectedActivity}
          isCompleted={completedIds.has(selectedActivity.id)}
          onClose={() => setSelectedActivity(null)}
          onComplete={() => {
            if (selectedTimeBlock) {
              handleToggleComplete(selectedActivity.id, selectedTimeBlock)
            }
            setSelectedActivity(null)
          }}
          onSwap={() => {
            setSwapActivity(selectedActivity)
            setShowSwapModal(true)
          }}
          onPush={() => {
            setPushActivity(selectedActivity)
            setSelectedActivity(null)
            setShowPushModal(true)
          }}
        />
      )}

      {/* Swap Modal */}
      {showSwapModal && swapActivity && (
        <SwapModal
          currentActivity={swapActivity}
          onClose={() => {
            setShowSwapModal(false)
            setSwapActivity(null)
          }}
          onSwap={handleSwap}
        />
      )}

      {/* Push Modal */}
      {showPushModal && (
        <PushModal
          activity={pushActivity}
          incompleteCount={incompleteActivities.length}
          onClose={() => {
            setShowPushModal(false)
            setPushActivity(null)
          }}
          onPushSingle={handlePushSingle}
          onPushAllIncomplete={handlePushAllIncomplete}
        />
      )}

      {/* Celebration */}
      <Celebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </div>
  )
}
