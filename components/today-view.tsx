'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ActivityCard } from './activity-card'
import { ActivityDetailModal } from './activity-detail-modal'
import { SwapModal } from './swap-modal'
import { PushModal } from './push-modal'
import { Celebration } from './celebration'
import { AddActivityModal } from './add-activity-modal'
import { WeatherDetailModal } from './weather-detail-modal'
import { Button } from '@/components/ui/button'
import { CalendarClock, Plus, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Activity,
  CATEGORIES,
  TimeBlock
} from '@/lib/activities'
import { useActivities } from '@/hooks/use-activities'
import { useWeather, getWeatherEmoji, formatTemp, isBadWeatherForOutdoor, WeatherDay } from '@/hooks/use-weather'
import { formatDateISO, shouldShowProfessionalGoals, formatDuration } from '@/lib/date-utils'
import { getRandomMessage, getStreakMessage, pickRandom } from '@/lib/messages'
import { useStorage, DailySchedule } from '@/hooks/use-storage'

interface TodayViewProps {
  onOpenMenu: () => void
}

// Visible time blocks in Today view
const TIME_BLOCKS: TimeBlock[] = ['before6am', 'before9am', 'beforeNoon', 'before230pm', 'before5pm', 'before9pm']

// Labels shown AFTER the activities for that time block (as deadlines)
const TIME_BLOCK_DEADLINE_LABELS: Record<TimeBlock, string> = {
  before6am: '6 AM',
  before9am: '9 AM',
  beforeNoon: '12 PM',
  before230pm: '2:30 PM',
  before5pm: '5 PM',
  before9pm: '9 PM',
  // Legacy blocks (not displayed but needed for type)
  before12pm: '12 PM',
  before3pm: '3 PM',
  before6pm: '6 PM',
  before12am: '12 AM'
}

export function TodayView({ onOpenMenu }: TodayViewProps) {
  const storage = useStorage()
  const { getActivity, getQuickMindBodyActivities } = useActivities()
  const { weather, getWeatherForDate, locationName } = useWeather()
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
  const [showAddModal, setShowAddModal] = useState(false)
  const [showWeatherDetail, setShowWeatherDetail] = useState(false)

  // Drag state
  const [dragState, setDragState] = useState<{
    activityId: string
    sourceBlock: TimeBlock
    sourceIndex: number
    currentY: number
    startY: number
    isDragging: boolean
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<{ block: TimeBlock; index: number } | null>(null)
  const blockRefs = useRef<Record<TimeBlock, HTMLDivElement | null>>({
    before6am: null,
    before9am: null,
    beforeNoon: null,
    before230pm: null,
    before5pm: null,
    before9pm: null,
    // Legacy blocks
    before12pm: null,
    before3pm: null,
    before6pm: null,
    before12am: null
  })
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const today = new Date()
  const dateStr = formatDateISO(today)

  // Generate daily schedule (fallback when no plan exists)
  const generateSchedule = useCallback((): DailySchedule => {
    const isProfessionalDay = shouldShowProfessionalGoals(today)

    const newSchedule: DailySchedule = {
      date: dateStr,
      activities: {
        before6am: [],
        before9am: [],
        beforeNoon: [],
        before230pm: [],
        before5pm: [],
        before9pm: []
      }
    }

    // Before 6 AM: Quick mind-body activity
    const quickMindBody = getQuickMindBodyActivities()
    const morningMindBody = quickMindBody.length > 0 ? pickRandom(quickMindBody) : null
    if (morningMindBody) {
      newSchedule.activities.before6am.push(morningMindBody.id)
    }

    // Before 9 AM: Physical activities
    newSchedule.activities.before9am.push('biking')
    newSchedule.activities.before9am.push('dumbbell_presses')

    // Before Noon: Professional tasks on weekdays
    if (isProfessionalDay) {
      newSchedule.activities.beforeNoon.push('coursera_module')
      newSchedule.activities.beforeNoon.push('job_search')
    }

    // Afternoon (before 2:30pm): More professional or mind-body
    if (isProfessionalDay) {
      newSchedule.activities.before230pm.push('job_followup')
    }

    // Before 9 PM: Evening mindfulness
    newSchedule.activities.before9pm.push('lin_health_education')

    return newSchedule
  }, [today, dateStr, getQuickMindBodyActivities])

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
    console.log('handleSwap called with:', newActivityId)
    console.log('schedule:', !!schedule, 'swapActivity:', swapActivity?.id, 'selectedTimeBlock:', selectedTimeBlock)

    if (!schedule || !swapActivity || !selectedTimeBlock) {
      console.log('handleSwap: missing required data, aborting')
      return
    }

    const newSchedule: DailySchedule = {
      ...schedule,
      activities: {
        ...schedule.activities,
        [selectedTimeBlock]: schedule.activities[selectedTimeBlock].map(id =>
          id === swapActivity.id ? newActivityId : id
        )
      }
    }

    console.log('handleSwap: saving new schedule', newSchedule)
    await storage.saveDailySchedule(newSchedule)
    console.log('handleSwap: schedule saved, updating state')
    setSchedule(newSchedule)
    setShowSwapModal(false)
    setSwapActivity(null)
    console.log('handleSwap: complete')
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
        activities: { before6am: [], before9am: [], beforeNoon: [], before230pm: [], before5pm: [], before9pm: [] }
      }
    }
    // Ensure the time block exists
    if (!tomorrowSchedule.activities[activityTimeBlock]) {
      tomorrowSchedule.activities[activityTimeBlock] = []
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
        activities: { before6am: [], before9am: [], beforeNoon: [], before230pm: [], before5pm: [], before9pm: [] }
      }
    }

    // Build new schedules
    const newTodayActivities: DailySchedule['activities'] = {
      before6am: [],
      before9am: [],
      beforeNoon: [],
      before230pm: [],
      before5pm: [],
      before9pm: []
    }

    for (const block of Object.keys(schedule.activities) as TimeBlock[]) {
      for (const activityId of schedule.activities[block]) {
        if (completedIds.has(activityId)) {
          // Keep completed activities in today
          if (!newTodayActivities[block]) newTodayActivities[block] = []
          newTodayActivities[block].push(activityId)
        } else {
          // Move incomplete to tomorrow
          if (!tomorrowSchedule.activities[block]) tomorrowSchedule.activities[block] = []
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

  // Handle adding activity
  const handleAddActivity = async (activityId: string, timeBlock: TimeBlock) => {
    if (!schedule) return

    const newSchedule: DailySchedule = {
      ...schedule,
      activities: {
        ...schedule.activities,
        [timeBlock]: [...schedule.activities[timeBlock], activityId]
      }
    }

    await storage.saveDailySchedule(newSchedule)
    setSchedule(newSchedule)
    setShowAddModal(false)
  }

  // Calculate drop target from Y position
  const getDropTargetFromY = (y: number): { block: TimeBlock; index: number } | null => {
    if (!schedule) return null

    // First check if we're above the first block - if so, return position 0 of first block
    const firstBlockEl = blockRefs.current.before9am
    if (firstBlockEl) {
      const firstRect = firstBlockEl.getBoundingClientRect()
      if (y < firstRect.top) {
        return { block: 'before9am', index: 0 }
      }
    }

    // Find the block and position based on Y coordinate
    for (const block of TIME_BLOCKS) {
      const blockEl = blockRefs.current[block]
      if (!blockEl) continue

      const blockRect = blockEl.getBoundingClientRect()
      if (y >= blockRect.top && y <= blockRect.bottom) {
        // We're in this block - now find the position
        const activities = schedule.activities[block] || []
        let insertIndex = activities.length // Default to end

        for (let i = 0; i < activities.length; i++) {
          const itemEl = itemRefs.current.get(`${block}-${activities[i]}`)
          if (itemEl) {
            const itemRect = itemEl.getBoundingClientRect()
            const itemMiddle = itemRect.top + itemRect.height / 2
            if (y < itemMiddle) {
              insertIndex = i
              break
            }
          }
        }

        return { block, index: insertIndex }
      }
    }

    // If outside all blocks (below), find the closest one
    let closestBlock: TimeBlock = 'before9pm'
    let closestDist = Infinity

    for (const block of TIME_BLOCKS) {
      const blockEl = blockRefs.current[block]
      if (!blockEl) continue

      const blockRect = blockEl.getBoundingClientRect()
      // Calculate distance to top and bottom
      const distToTop = Math.abs(y - blockRect.top)
      const distToBottom = Math.abs(y - blockRect.bottom)
      const dist = Math.min(distToTop, distToBottom)

      if (dist < closestDist) {
        closestDist = dist
        closestBlock = block
      }
    }

    const activities = schedule.activities[closestBlock] || []
    return { block: closestBlock, index: activities.length }
  }

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent, activityId: string, block: TimeBlock, index: number) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    setDragState({
      activityId,
      sourceBlock: block,
      sourceIndex: index,
      currentY: e.clientY,
      startY: e.clientY,
      isDragging: false
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return

    const deltaY = Math.abs(e.clientY - dragState.startY)

    // Start dragging after threshold
    if (!dragState.isDragging && deltaY > 5) {
      setDragState(prev => prev ? { ...prev, isDragging: true, currentY: e.clientY } : null)
    } else if (dragState.isDragging) {
      setDragState(prev => prev ? { ...prev, currentY: e.clientY } : null)

      // Update drop target
      const target = getDropTargetFromY(e.clientY)
      setDropTarget(target)
    }
  }

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (!dragState || !schedule) {
      setDragState(null)
      setDropTarget(null)
      return
    }

    if (dragState.isDragging && dropTarget) {
      // Perform the move
      const { activityId, sourceBlock, sourceIndex } = dragState
      const { block: targetBlock, index: targetIndex } = dropTarget

      // Remove from source
      const newSourceActivities = [...schedule.activities[sourceBlock]]
      newSourceActivities.splice(sourceIndex, 1)

      // Calculate adjusted target index
      let adjustedTargetIndex = targetIndex
      if (sourceBlock === targetBlock && sourceIndex < targetIndex) {
        adjustedTargetIndex = Math.max(0, targetIndex - 1)
      }

      // Add to target
      const newTargetActivities = sourceBlock === targetBlock
        ? newSourceActivities
        : [...schedule.activities[targetBlock]]
      newTargetActivities.splice(adjustedTargetIndex, 0, activityId)

      const newSchedule: DailySchedule = {
        ...schedule,
        activities: {
          ...schedule.activities,
          [sourceBlock]: sourceBlock === targetBlock ? newTargetActivities : newSourceActivities,
          [targetBlock]: newTargetActivities
        }
      }

      await storage.saveDailySchedule(newSchedule)
      setSchedule(newSchedule)
    }

    setDragState(null)
    setDropTarget(null)
  }

  // Calculate incomplete count - only count activities that actually exist
  const incompleteActivities = schedule
    ? Object.values(schedule.activities).flat().filter(id => {
        const activity = getActivity(id)
        return activity && !completedIds.has(id)
      })
    : []

  // Calculate progress - only count activities that actually exist
  const allScheduledActivities = schedule
    ? Object.values(schedule.activities).flat().filter(id => getActivity(id))
    : []
  const totalActivities = allScheduledActivities.length
  const completedCount = allScheduledActivities.filter(id => completedIds.has(id)).length

  if (!schedule) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your plan...</p>
      </div>
    )
  }

  // Get today's weather
  const todayWeather = getWeatherForDate(dateStr)
  const hasOutdoorActivities = schedule && Object.values(schedule.activities).flat().some(id => {
    const activity = getActivity(id)
    return activity?.outdoor || activity?.weatherDependent
  })
  const badWeatherWarning = todayWeather && isBadWeatherForOutdoor(todayWeather) && hasOutdoorActivities

  return (
    <div className="space-y-6">
      {/* Weather + Motivation Card */}
      <div className="rounded-2xl border-l-4 border-l-[var(--accent)] bg-card p-6 shadow-sm">
        {todayWeather && (
          <button
            onClick={() => setShowWeatherDetail(true)}
            className="w-full flex items-center gap-3 mb-3 pb-3 border-b border-border hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors text-left"
          >
            <span className="text-3xl">{getWeatherEmoji(todayWeather.weather.main, todayWeather.weather.id)}</span>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold">{formatTemp(todayWeather.temp.max)}</span>
                <span className="text-sm text-muted-foreground">/ {formatTemp(todayWeather.temp.min)}</span>
              </div>
              <p className="text-sm text-muted-foreground capitalize">{todayWeather.weather.description}</p>
            </div>
            {todayWeather.pop > 0.1 && (
              <div className="text-right">
                <span className="text-blue-500 font-medium">{Math.round(todayWeather.pop * 100)}%</span>
                <p className="text-xs text-muted-foreground">rain</p>
              </div>
            )}
          </button>
        )}
        {badWeatherWarning && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
            ⚠️ Outdoor activities may be affected by weather today
          </div>
        )}
        <p className="text-lg font-medium leading-relaxed text-foreground font-sans" suppressHydrationWarning>
          {motivation || '\u00A0'}
        </p>
      </div>

      {/* Daily Plan - Activities appear ABOVE their deadline time */}
      <div className="space-y-2">
        {TIME_BLOCKS.map((block, blockIndex) => {
          const activities = schedule.activities[block] || []
          const hasActivities = activities.length > 0
          const deadlineLabel = TIME_BLOCK_DEADLINE_LABELS[block]

          return (
            <div
              key={block}
              ref={el => { blockRefs.current[block] = el }}
            >
              {/* Drop indicator at start of block */}
              {dropTarget?.block === block && dropTarget.index === 0 && dragState?.isDragging && (
                <div className="h-1 bg-primary rounded-full mx-2 mb-2" />
              )}

              {/* Activities for this time block */}
              {hasActivities ? (
                <div className="space-y-2">
                  {activities.map((activityId, index) => {
                    const activity = getActivity(activityId)
                    if (!activity) return null

                    const isDragging = dragState?.activityId === activityId && dragState?.isDragging
                    const itemKey = `${block}-${activityId}`

                    return (
                      <div key={activityId}>
                        <div
                          ref={el => {
                            if (el) itemRefs.current.set(itemKey, el)
                            else itemRefs.current.delete(itemKey)
                          }}
                          className={cn(
                            'relative flex items-center gap-2',
                            isDragging && 'opacity-50'
                          )}
                        >
                          {/* Drag handle */}
                          <div
                            onPointerDown={(e) => handlePointerDown(e, activityId, block, index)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
                          >
                            <GripVertical className="h-5 w-5" />
                          </div>

                          {/* Activity card */}
                          <div className="flex-1">
                            <ActivityCard
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
                          </div>
                        </div>

                        {/* Drop indicator after this item */}
                        {dropTarget?.block === block && dropTarget.index === index + 1 && dragState?.isDragging && (
                          <div className="h-1 bg-primary rounded-full mx-2 mt-2" />
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {/* Time deadline divider - shows AFTER activities as the deadline */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {deadlineLabel}
                </span>
                <div className="flex-1 h-px bg-border" />
                <button
                  onClick={() => setShowAddModal(true)}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Activity Button */}
      <Button
        variant="outline"
        className="w-full bg-transparent"
        onClick={() => setShowAddModal(true)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Activity
      </Button>

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

      {/* Add Activity Modal */}
      {showAddModal && (
        <AddActivityModal
          targetDate={today}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddActivity}
        />
      )}

      {/* Celebration */}
      <Celebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {/* Weather Detail Modal */}
      {showWeatherDetail && todayWeather && (
        <WeatherDetailModal
          weather={todayWeather}
          locationName={locationName}
          onClose={() => setShowWeatherDetail(false)}
        />
      )}
    </div>
  )
}
