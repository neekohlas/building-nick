'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivityCard } from './activity-card'
import { ActivityDetailModal } from './activity-detail-modal'
import { SwapModal } from './swap-modal'
import { PushModal } from './push-modal'
import { Celebration } from './celebration'
import { AddActivityModal } from './add-activity-modal'
import {
  formatDateISO,
  getShortDayName,
  getDayNumber,
  isToday,
  addDays,
  getMonthName,
  getYear,
  getExtendedWeekDates,
  shouldShowProfessionalGoals,
  formatDateShort
} from '@/lib/date-utils'
import { Activity, ACTIVITIES, getQuickMindBodyActivities, getPhysicalActivities } from '@/lib/activities'
import { useStorage, DailySchedule } from '@/hooks/use-storage'
import { pickRandom } from '@/lib/messages'
import { Button } from '@/components/ui/button'

interface WeekViewProps {
  onBack: () => void
}

type TimeBlock = 'before9am' | 'beforeNoon' | 'anytime'

export function WeekView({ onBack }: WeekViewProps) {
  const storage = useStorage()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [visibleDates, setVisibleDates] = useState<Date[]>([])
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const weekDates = getExtendedWeekDates(new Date(), 14)

  // Modals
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock | null>(null)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapActivity, setSwapActivity] = useState<Activity | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPushModal, setShowPushModal] = useState(false)
  const [pushActivity, setPushActivity] = useState<Activity | null>(null)

  // Initialize extended dates for scrolling (2 weeks before and after)
  useEffect(() => {
    setVisibleDates(getExtendedWeekDates(new Date(), 14))
  }, [])

  // Scroll to selected date
  useEffect(() => {
    if (scrollContainerRef.current) {
      const selectedIndex = visibleDates.findIndex(
        d => formatDateISO(d) === formatDateISO(selectedDate)
      )
      if (selectedIndex >= 0) {
        const container = scrollContainerRef.current
        const dayWidth = 64 // min-w-16 = 64px
        const scrollPosition = (selectedIndex * dayWidth) - (container.clientWidth / 2) + (dayWidth / 2)
        container.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' })
      }
    }
  }, [selectedDate, visibleDates])

  // Generate schedule for a date
  // Before 9am is ALWAYS physical or mind-body activities only
  const generateSchedule = (date: Date): DailySchedule => {
    const dateStr = formatDateISO(date)
    const isProfessionalDay = shouldShowProfessionalGoals(date)

    const newSchedule: DailySchedule = {
      date: dateStr,
      activities: {
        before9am: [],
        beforeNoon: [],
        anytime: []
      }
    }

    // Before 9am: Always mind-body or physical activities
    const quickMindBody = getQuickMindBodyActivities()
    const morningMindBody = pickRandom(quickMindBody)
    newSchedule.activities.before9am.push(morningMindBody.id)

    // Add a physical activity in the morning too (light option)
    const physicalActivities = getPhysicalActivities()
    const lightPhysical = physicalActivities.find(a => a.id === 'stretching') || pickRandom(physicalActivities)
    if (lightPhysical.id !== morningMindBody.id) {
      newSchedule.activities.before9am.push(lightPhysical.id)
    }

    // Before Noon: Main physical activities
    newSchedule.activities.beforeNoon.push('biking')
    newSchedule.activities.beforeNoon.push('dumbbell_presses')

    if (isProfessionalDay) {
      newSchedule.activities.beforeNoon.push('coursera_module')
    }

    // Anytime: Lin Health and professional tasks
    newSchedule.activities.anytime.push('lin_health_activity')

    if (isProfessionalDay) {
      newSchedule.activities.anytime.push('job_search')
      newSchedule.activities.anytime.push('job_followup')
    }

    return newSchedule
  }

  // Load schedule for selected date
  useEffect(() => {
    if (!storage.isReady) return

    async function loadSchedule() {
      const dateStr = formatDateISO(selectedDate)
      let existingSchedule = await storage.getDailySchedule(dateStr)

      if (!existingSchedule) {
        existingSchedule = generateSchedule(selectedDate)
        await storage.saveDailySchedule(existingSchedule)
      }

      setSchedule(existingSchedule)

      const completions = await storage.getCompletionsForDate(dateStr)
      setCompletedIds(new Set(completions.map(c => c.activityId)))
    }

    loadSchedule()
  }, [storage.isReady, selectedDate, storage])

  // Navigate days
  const goToPreviousDay = () => {
    setSelectedDate(prev => addDays(prev, -1))
  }

  const goToNextDay = () => {
    setSelectedDate(prev => addDays(prev, 1))
  }

  const goToToday = () => {
    setSelectedDate(new Date())
  }

  const goToPreviousWeek = () => {
    setSelectedDate(prev => addDays(prev, -7))
  }

  const goToNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7))
  }

  // Toggle completion
  const handleToggleComplete = async (activityId: string, timeBlock: TimeBlock) => {
    if (!storage.isReady) return

    const dateStr = formatDateISO(selectedDate)
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
    }
  }

  // Handle swap
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

  // Handle add activity
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

  // Get tomorrow's date string
  const getTomorrowDateStr = () => {
    const tomorrow = new Date(selectedDate)
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

    // Remove from selected date
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
          // Keep completed activities in selected date
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

  return (
    <div className="space-y-4">
      {/* Month Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {getMonthName(selectedDate)}{' '}
            <span className="text-primary">{getYear(selectedDate)}</span>
          </h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={goToToday}
          className={cn(
            "rounded-full h-9 w-9 p-0 font-bold",
            isToday(selectedDate) ? "bg-primary text-primary-foreground" : "bg-transparent"
          )}
        >
          {getDayNumber(new Date())}
        </Button>
      </div>

      {/* Horizontal Scrollable Day Selector */}
      <div 
        ref={scrollContainerRef}
        className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleDates.map(date => {
          const isSelected = formatDateISO(date) === formatDateISO(selectedDate)
          const isTodayDate = isToday(date)
          const dayName = getShortDayName(date).toUpperCase()

          return (
            <button
              key={formatDateISO(date)}
              onClick={() => setSelectedDate(date)}
              className={cn(
                'flex flex-col items-center py-2 min-w-16 rounded-xl transition-all shrink-0',
                isSelected
                  ? 'bg-primary/10'
                  : 'hover:bg-muted'
              )}
            >
              <span className={cn(
                "text-[10px] font-semibold tracking-wide mb-1",
                isSelected ? "text-primary" : "text-muted-foreground"
              )}>
                {dayName}
              </span>
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full text-lg font-bold transition-all",
                isSelected && "bg-primary text-primary-foreground",
                isTodayDate && !isSelected && "ring-2 ring-primary"
              )}>
                {getDayNumber(date)}
              </div>
            </button>
          )
        })}
      </div>

      {/* Selected Day Actions */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={goToPreviousDay}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-foreground">
            {getShortDayName(selectedDate)}, {getMonthName(selectedDate).slice(0, 3)} {getDayNumber(selectedDate)}
            {isToday(selectedDate) && (
              <span className="ml-1 text-primary">(Today)</span>
            )}
          </span>
          <button 
            onClick={goToNextDay}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddModal(true)}
          className="bg-transparent"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Activities for Selected Day */}
      {schedule && (
        <div className="space-y-6">
          {(['before9am', 'beforeNoon', 'anytime'] as TimeBlock[]).map(block => {
            const activities = schedule.activities[block]
            if (activities.length === 0) return null

            return (
              <div key={block} className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  {block === 'before9am' && 'Before 9 AM'}
                  {block === 'beforeNoon' && 'Before Noon'}
                  {block === 'anytime' && 'Anytime'}
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
      )}

      {/* Modals */}
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

      {showAddModal && (
        <AddActivityModal
          targetDate={selectedDate}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddActivity}
        />
      )}

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

      <Celebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </div>
  )
}
