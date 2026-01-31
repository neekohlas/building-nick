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
import { Activity, getQuickMindBodyActivities, getPhysicalActivities } from '@/lib/activities'
import { useStorage, DailySchedule } from '@/hooks/use-storage'
import { useActivities } from '@/hooks/use-activities'
import { useWeather, getWeatherEmoji, formatTemp, WeatherDay } from '@/hooks/use-weather'
import { useCalendar } from '@/hooks/use-calendar'
import { CalendarEventCard, CalendarEventListItem } from './calendar-event-card'
import { WeatherDetailModal } from './weather-detail-modal'
import { pickRandom } from '@/lib/messages'
import { Button } from '@/components/ui/button'

interface WeekViewProps {
  onBack: () => void
}

type TimeBlock = 'before6am' | 'before9am' | 'beforeNoon' | 'before230pm' | 'before5pm' | 'before9pm'

export function WeekView({ onBack }: WeekViewProps) {
  const storage = useStorage()
  const { getActivity } = useActivities()
  const { getWeatherForDate, isLoading: weatherLoading, locationName } = useWeather()
  const { isConnected: calendarConnected, getEventsForDate, getEventsForTimeBlock, formatEventTime, getEventDuration } = useCalendar()
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
  const [showWeatherDetail, setShowWeatherDetail] = useState(false)
  const [weatherDetailData, setWeatherDetailData] = useState<WeatherDay | null>(null)

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
        before6am: [],
        before9am: [],
        beforeNoon: [],
        before230pm: [],
        before5pm: [],
        before9pm: []
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

    // Before 5pm: Professional tasks
    if (isProfessionalDay) {
      newSchedule.activities.before5pm.push('job_search')
      newSchedule.activities.before5pm.push('job_followup')
    }

    // Before 9pm: Lin Health activity
    newSchedule.activities.before9pm.push('lin_health_education')

    return newSchedule
  }

  // Load schedule for selected date
  useEffect(() => {
    if (!storage.isReady) return

    async function loadSchedule() {
      const dateStr = formatDateISO(selectedDate)
      console.log('WeekView: Loading schedule for', dateStr)
      let existingSchedule = await storage.getDailySchedule(dateStr)
      console.log('WeekView: Existing schedule:', existingSchedule)

      if (!existingSchedule) {
        console.log('WeekView: No schedule found, generating default')
        existingSchedule = generateSchedule(selectedDate)
        await storage.saveDailySchedule(existingSchedule)
      }

      setSchedule(existingSchedule)

      const completions = await storage.getCompletionsForDate(dateStr)
      setCompletedIds(new Set(completions.map(c => c.activityId)))
    }

    loadSchedule()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage.isReady, selectedDate])

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
        activities: { before6am: [], before9am: [], beforeNoon: [], before230pm: [], before5pm: [], before9pm: [] }
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
          const dayWeather = getWeatherForDate(formatDateISO(date))

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
              {dayWeather && (
                <div className="flex items-center gap-0.5 mt-1">
                  <span className="text-xs">{getWeatherEmoji(dayWeather.weather.main, dayWeather.weather.id)}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTemp(dayWeather.temp.max)}</span>
                </div>
              )}
              {calendarConnected && (() => {
                const eventsForDay = getEventsForDate(formatDateISO(date))
                return eventsForDay.length > 0 ? (
                  <span className="text-[10px] text-blue-500 mt-0.5">
                    {eventsForDay.length} event{eventsForDay.length !== 1 ? 's' : ''}
                  </span>
                ) : null
              })()}
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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {getShortDayName(selectedDate)}, {getMonthName(selectedDate).slice(0, 3)} {getDayNumber(selectedDate)}
              {isToday(selectedDate) && (
                <span className="ml-1 text-primary">(Today)</span>
              )}
            </span>
            {(() => {
              const selectedWeather = getWeatherForDate(formatDateISO(selectedDate))
              if (!selectedWeather) return null
              return (
                <button
                  onClick={() => {
                    setWeatherDetailData(selectedWeather)
                    setShowWeatherDetail(true)
                  }}
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:bg-muted px-1.5 py-0.5 rounded transition-colors"
                >
                  {getWeatherEmoji(selectedWeather.weather.main, selectedWeather.weather.id)}
                  {formatTemp(selectedWeather.temp.min)}-{formatTemp(selectedWeather.temp.max)}
                  {selectedWeather.pop > 0.2 && (
                    <span className="text-blue-500">{Math.round(selectedWeather.pop * 100)}%</span>
                  )}
                </button>
              )
            })()}
          </div>
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

      {/* Activities for Selected Day - with time dividers */}
      {schedule && (
        <div className="space-y-2">
          {(['before6am', 'before9am', 'beforeNoon', 'before230pm', 'before5pm', 'before9pm'] as TimeBlock[]).map(block => {
            const activities = schedule.activities[block] || []
            const calendarEvents = calendarConnected ? getEventsForTimeBlock(formatDateISO(selectedDate), block) : []
            const hasContent = activities.length > 0 || calendarEvents.length > 0

            // Time labels for dividers (shown AFTER the content as deadlines)
            const timeLabel = {
              before6am: '6 AM',
              before9am: '9 AM',
              beforeNoon: '12 PM',
              before230pm: '2:30 PM',
              before5pm: '5 PM',
              before9pm: '9 PM'
            }[block]

            return (
              <div key={block}>
                {/* Calendar events for this time block */}
                {calendarEvents.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {calendarEvents.map(event => (
                      <CalendarEventCard
                        key={event.id}
                        event={event}
                        compact={true}
                        formatTime={formatEventTime}
                        getDuration={getEventDuration}
                      />
                    ))}
                  </div>
                )}

                {/* Activities for this time block */}
                {activities.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {activities.map(activityId => {
                      const activity = getActivity(activityId)
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
                )}

                {/* Time divider line */}
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    {timeLabel}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
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

      {/* Weather Detail Modal */}
      {showWeatherDetail && weatherDetailData && (
        <WeatherDetailModal
          weather={weatherDetailData}
          locationName={locationName}
          onClose={() => {
            setShowWeatherDetail(false)
            setWeatherDetailData(null)
          }}
        />
      )}
    </div>
  )
}
