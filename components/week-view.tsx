'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivityCard } from './activity-card'
import { ActivityDetailModal } from './activity-detail-modal'
import { SwapModal } from './swap-modal'
import { Celebration } from './celebration'
import { AddActivityModal } from './add-activity-modal'
import {
  formatDateISO,
  formatDateShort,
  getShortDayName,
  getDayNumber,
  isToday,
  addDays,
  getWeekDates,
  shouldShowProfessionalGoals
} from '@/lib/date-utils'
import { Activity, ACTIVITIES, getQuickMindBodyActivities } from '@/lib/activities'
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
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  // Modals
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock | null>(null)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapActivity, setSwapActivity] = useState<Activity | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // Initialize week dates
  useEffect(() => {
    setWeekDates(getWeekDates(selectedDate))
  }, [selectedDate])

  // Generate schedule for a date
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

    const quickActivities = getQuickMindBodyActivities()
    const picked = pickRandom(quickActivities)
    newSchedule.activities.before9am.push(picked.id)

    if (isProfessionalDay) {
      newSchedule.activities.before9am.push('job_followup')
    }

    newSchedule.activities.beforeNoon.push('biking')
    newSchedule.activities.beforeNoon.push('dumbbell_presses')

    if (isProfessionalDay) {
      newSchedule.activities.beforeNoon.push('coursera_module')
    }

    newSchedule.activities.anytime.push('lin_health_activity')

    if (isProfessionalDay) {
      newSchedule.activities.anytime.push('job_search')
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

  // Navigate weeks
  const goToPreviousWeek = () => {
    setSelectedDate(prev => addDays(prev, -7))
  }

  const goToNextWeek = () => {
    setSelectedDate(prev => addDays(prev, 7))
  }

  const goToToday = () => {
    setSelectedDate(new Date())
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

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousWeek}
          className="p-2 rounded-lg hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={goToToday}
          className="text-sm font-medium text-primary hover:underline"
        >
          Go to Today
        </button>

        <button
          onClick={goToNextWeek}
          className="p-2 rounded-lg hover:bg-muted"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Date Selector */}
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-4 px-4">
        {weekDates.map(date => {
          const isSelected = formatDateISO(date) === formatDateISO(selectedDate)
          const isTodayDate = isToday(date)

          return (
            <button
              key={formatDateISO(date)}
              onClick={() => setSelectedDate(date)}
              className={cn(
                'flex flex-col items-center px-4 py-2 rounded-xl min-w-[60px] transition-all',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
                isTodayDate && !isSelected && 'ring-2 ring-primary ring-offset-2'
              )}
            >
              <span className="text-xs font-medium opacity-80">
                {getShortDayName(date)}
              </span>
              <span className="text-lg font-bold">
                {getDayNumber(date)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Selected Day Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {formatDateShort(selectedDate)}
          {isToday(selectedDate) && (
            <span className="ml-2 text-sm font-normal text-primary">(Today)</span>
          )}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddModal(true)}
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

      <Celebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />
    </div>
  )
}
