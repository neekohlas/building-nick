'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, GripVertical } from 'lucide-react'
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
import { DailySchedule, Completion } from '@/hooks/use-storage'
import { useSync } from '@/hooks/use-sync'
import { useActivities } from '@/hooks/use-activities'
import { useWeather, getWeatherEmoji, formatTemp, WeatherDay, WeatherHour } from '@/hooks/use-weather'
import { useCalendar } from '@/hooks/use-calendar'
import { CalendarEventCard, CalendarEventListItem } from './calendar-event-card'
import { WeatherDetailModal } from './weather-detail-modal'
import { pickRandom } from '@/lib/messages'
import { Button } from '@/components/ui/button'
import { getRemindersForTimeBlock, getOverdueReminders } from '@/lib/reminders'
import { ReminderCard, OverdueRemindersSection } from './reminder-card'

interface WeekViewProps {
  onBack: () => void
}

type TimeBlock = 'before6am' | 'before9am' | 'beforeNoon' | 'before230pm' | 'before5pm' | 'before9pm'

export function WeekView({ onBack }: WeekViewProps) {
  const storage = useSync()
  const { getActivity } = useActivities()
  const { getWeatherForDate, getHourlyForDate, isLoading: weatherLoading, locationName } = useWeather()
  const { isConnected: calendarConnected, getEventsForDate, getEventsForTimeBlock, formatEventTime, getEventDuration } = useCalendar()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [visibleDates, setVisibleDates] = useState<Date[]>([])
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [completions, setCompletions] = useState<Completion[]>([])
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
  const [weatherDetailDate, setWeatherDetailDate] = useState<string | null>(null)
  const [deleteConfirmActivity, setDeleteConfirmActivity] = useState<{ id: string; name: string; block: TimeBlock } | null>(null)
  const [remindersRefreshKey, setRemindersRefreshKey] = useState(0)
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedStravaCompletion, setSelectedStravaCompletion] = useState<Completion | null>(null)

  // Drag state for reordering
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
    before6am: null, before9am: null, beforeNoon: null,
    before230pm: null, before5pm: null, before9pm: null
  })
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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

      const loadedCompletions = await storage.getCompletionsForDate(dateStr)
      setCompletedIds(new Set(loadedCompletions.map(c => c.activityId)))
      setCompletions(loadedCompletions)
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
  const handleToggleComplete = async (activityId: string, timeBlock: TimeBlock, durationMinutes?: number) => {
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
        timeBlock,
        ...(durationMinutes != null ? { durationMinutes } : {})
      })
      setCompletedIds(prev => new Set([...prev, activityId]))
      setShowCelebration(true)
    }
  }

  // Handle reminder completion toggle
  const handleToggleReminderComplete = (reminderId: string) => {
    storage.toggleReminderCompletion(reminderId)
    setRemindersRefreshKey(k => k + 1)
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

  // Remove activity from schedule
  const handleRemoveActivity = async (activityId: string, timeBlock: TimeBlock) => {
    if (!schedule) return

    // Remove from schedule
    const newSchedule: DailySchedule = {
      ...schedule,
      activities: {
        ...schedule.activities,
        [timeBlock]: schedule.activities[timeBlock].filter(id => id !== activityId)
      }
    }
    await storage.saveDailySchedule(newSchedule)
    setSchedule(newSchedule)
    setSelectedActivity(null)
    setDeleteConfirmActivity(null)
  }

  // Drag handlers for reordering
  const TIME_BLOCKS_LIST: TimeBlock[] = ['before6am', 'before9am', 'beforeNoon', 'before230pm', 'before5pm', 'before9pm']

  const getDropTargetFromY = (y: number): { block: TimeBlock; index: number } | null => {
    if (!schedule) return null

    const blockZones: { block: TimeBlock; top: number; bottom: number }[] = []
    const blockRects: { block: TimeBlock; rect: DOMRect }[] = []

    for (const block of TIME_BLOCKS_LIST) {
      const el = blockRefs.current[block]
      if (!el) continue
      blockRects.push({ block, rect: el.getBoundingClientRect() })
    }

    for (let i = 0; i < blockRects.length; i++) {
      const { block, rect } = blockRects[i]
      const zoneTop = i === 0 ? 0 : (blockRects[i - 1].rect.bottom + rect.top) / 2
      const zoneBottom = i === blockRects.length - 1 ? Infinity : (rect.bottom + blockRects[i + 1].rect.top) / 2
      blockZones.push({ block, top: zoneTop, bottom: zoneBottom })
    }

    for (const zone of blockZones) {
      if (y >= zone.top && y < zone.bottom) {
        const activities = schedule.activities[zone.block] || []
        let insertIndex = activities.length

        for (let i = 0; i < activities.length; i++) {
          const itemKey = `${zone.block}-${activities[i]}-${i}`
          const itemEl = itemRefs.current.get(itemKey)
          if (itemEl) {
            const itemRect = itemEl.getBoundingClientRect()
            const itemMiddle = itemRect.top + itemRect.height / 2
            if (y < itemMiddle) {
              insertIndex = i
              break
            }
          }
        }

        return { block: zone.block, index: insertIndex }
      }
    }

    const lastBlock = TIME_BLOCKS_LIST[TIME_BLOCKS_LIST.length - 1]
    return { block: lastBlock, index: (schedule.activities[lastBlock] || []).length }
  }

  const handlePointerDown = (e: React.PointerEvent, activityId: string, block: TimeBlock, index: number) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    setDragState({
      activityId, sourceBlock: block, sourceIndex: index,
      currentY: e.clientY, startY: e.clientY, isDragging: false
    })
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return
    const deltaY = Math.abs(e.clientY - dragState.startY)
    if (!dragState.isDragging && deltaY > 5) {
      setDragState(prev => prev ? { ...prev, isDragging: true, currentY: e.clientY } : null)
    } else if (dragState.isDragging) {
      setDragState(prev => prev ? { ...prev, currentY: e.clientY } : null)
      setDropTarget(getDropTargetFromY(e.clientY))
    }
  }

  const handlePointerUp = async () => {
    if (!dragState || !schedule) {
      setDragState(null)
      setDropTarget(null)
      return
    }

    if (dragState.isDragging && dropTarget) {
      const { activityId, sourceBlock, sourceIndex } = dragState
      const { block: targetBlock, index: targetIndex } = dropTarget

      const newSourceActivities = [...schedule.activities[sourceBlock]]
      newSourceActivities.splice(sourceIndex, 1)

      let adjustedTargetIndex = targetIndex
      if (sourceBlock === targetBlock && sourceIndex < targetIndex) {
        adjustedTargetIndex = Math.max(0, targetIndex - 1)
      }

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
                    setWeatherDetailDate(formatDateISO(selectedDate))
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

      {/* Overdue Reminders */}
      {(() => {
        // Use remindersRefreshKey to trigger re-render on toggle
        const _ = remindersRefreshKey
        const overdueReminders = getOverdueReminders(selectedDate)
        return overdueReminders.length > 0 ? (
          <OverdueRemindersSection
            reminders={overdueReminders}
            onToggleComplete={handleToggleReminderComplete}
          />
        ) : null
      })()}

      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="sticky top-0 z-20 -mx-4 px-4 py-3 bg-primary text-primary-foreground flex items-center justify-between shadow-md">
          <span className="font-medium">Drag activities to reorder</span>
          <button
            onClick={() => setIsEditMode(false)}
            className="px-4 py-1.5 rounded-full bg-white/20 hover:bg-white/30 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Activities for Selected Day - with time dividers */}
      {schedule && (
        <div className="space-y-2">
          {(['before6am', 'before9am', 'beforeNoon', 'before230pm', 'before5pm', 'before9pm'] as TimeBlock[]).map(block => {
            const activities = schedule.activities[block] || []
            const calendarEvents = calendarConnected ? getEventsForTimeBlock(formatDateISO(selectedDate), block) : []
            const blockReminders = getRemindersForTimeBlock(selectedDate, block)
            const hasContent = activities.length > 0 || calendarEvents.length > 0 || blockReminders.length > 0

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
              <div key={block} ref={el => { blockRefs.current[block] = el }}>
                {/* Drop indicator at start of block */}
                {dropTarget?.block === block && dropTarget.index === 0 && dragState?.isDragging && (
                  <div className="h-1 bg-primary rounded-full mx-2 mb-2" />
                )}

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

                {/* Reminders for this time block */}
                {blockReminders.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {blockReminders.map(reminder => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        onToggleComplete={() => handleToggleReminderComplete(reminder.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Activities for this time block */}
                {activities.length > 0 && (
                  <div className="space-y-2 mb-2">
                    {activities.map((activityId, index) => {
                      const activity = getActivity(activityId)
                      if (!activity) return null

                      const isDragging = dragState?.activityId === activityId && dragState?.isDragging
                      const itemKey = `${block}-${activityId}-${index}`

                      // Check for Strava completion for this scheduled activity
                      const directlyCompleted = completedIds.has(activityId)
                      const stravaCompletion = !directlyCompleted
                        ? completions.find(c => c.activityId === activityId && c.stravaActivityName)
                        : completions.find(c => c.activityId === activityId && c.timeBlock === block && c.stravaActivityName)
                      const isCompleted = directlyCompleted || !!stravaCompletion

                      return (
                        <div key={itemKey}>
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
                            {/* Drag handle - only visible in edit mode */}
                            {isEditMode && (
                              <div
                                onPointerDown={(e) => handlePointerDown(e, activityId, block, index)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                className="flex-shrink-0 p-1 cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
                              >
                                <GripVertical className="h-5 w-5" />
                              </div>
                            )}

                            <div className="flex-1">
                              <ActivityCard
                                activity={activity}
                                isCompleted={isCompleted}
                                timeBlock={block}
                                customDuration={stravaCompletion?.durationMinutes}
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
                                  setSelectedStravaCompletion(stravaCompletion || null)
                                }}
                                onReorder={() => setIsEditMode(true)}
                                onDelete={() => setDeleteConfirmActivity({ id: activityId, name: activity.name, block })}
                                stravaName={stravaCompletion?.stravaActivityName}
                                stravaDistance={stravaCompletion?.stravaDistance}
                                stravaSportType={stravaCompletion?.stravaSportType}
                                stravaCalories={stravaCompletion?.stravaCalories}
                                stravaAvgHeartrate={stravaCompletion?.stravaAvgHeartrate}
                                stravaStartTime={stravaCompletion?.stravaStartTime}
                                stravaElapsedSeconds={stravaCompletion?.stravaElapsedSeconds}
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
                )}

                {/* Unscheduled completions for this time block (e.g. Strava imports) */}
                {schedule && completions.length > 0 && (() => {
                  const scheduledInBlock = new Set(activities)
                  const unscheduledCompletions = completions.filter(
                    c => c.timeBlock === block && !scheduledInBlock.has(c.activityId)
                  )
                  if (unscheduledCompletions.length === 0) return null
                  return (
                    <div className="space-y-2 mb-2">
                      {unscheduledCompletions.map(completion => {
                        const activity = getActivity(completion.activityId)
                        if (!activity) return null
                        return (
                          <ActivityCard
                            key={`strava-${completion.id}`}
                            activity={activity}
                            isCompleted={true}
                            timeBlock={block}
                            customDuration={completion.durationMinutes}
                            stravaName={completion.stravaActivityName}
                            stravaDistance={completion.stravaDistance}
                            stravaSportType={completion.stravaSportType}
                            stravaCalories={completion.stravaCalories}
                            stravaAvgHeartrate={completion.stravaAvgHeartrate}
                            stravaStartTime={completion.stravaStartTime}
                            stravaElapsedSeconds={completion.stravaElapsedSeconds}
                            onToggleComplete={() => {}}
                            onClick={() => {
                              setSelectedActivity(activity)
                              setSelectedTimeBlock(block)
                              setSelectedStravaCompletion(completion.stravaActivityName ? completion : null)
                            }}
                          />
                        )
                      })}
                    </div>
                  )
                })()}

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
          stravaActivityName={selectedStravaCompletion?.stravaActivityName}
          stravaDistance={selectedStravaCompletion?.stravaDistance}
          stravaSportType={selectedStravaCompletion?.stravaSportType}
          stravaCalories={selectedStravaCompletion?.stravaCalories}
          stravaAvgHeartrate={selectedStravaCompletion?.stravaAvgHeartrate}
          stravaStartTime={selectedStravaCompletion?.stravaStartTime}
          stravaElapsedSeconds={selectedStravaCompletion?.stravaElapsedSeconds}
          onClose={() => { setSelectedActivity(null); setSelectedStravaCompletion(null) }}
          onComplete={(durationMinutes) => {
            if (selectedTimeBlock) {
              handleToggleComplete(selectedActivity.id, selectedTimeBlock, durationMinutes)
            }
            setSelectedActivity(null)
            setSelectedStravaCompletion(null)
          }}
          onDurationChange={(durationMinutes) => {
            if (selectedTimeBlock) {
              const dateStr = formatDateISO(selectedDate)
              storage.updateCompletionDuration(dateStr, selectedActivity.id, selectedTimeBlock, 0, durationMinutes)
            }
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
          hourly={weatherDetailDate ? getHourlyForDate(weatherDetailDate) : undefined}
          locationName={locationName}
          onClose={() => {
            setShowWeatherDetail(false)
            setWeatherDetailData(null)
            setWeatherDetailDate(null)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteConfirmActivity(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card p-6 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Remove Activity?</h3>
            <p className="text-muted-foreground mb-6">
              Remove <span className="font-medium text-foreground">{deleteConfirmActivity.name}</span> from this day's schedule?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmActivity(null)}
                className="flex-1 py-2.5 rounded-lg border border-border font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemoveActivity(deleteConfirmActivity.id, deleteConfirmActivity.block)}
                className="flex-1 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
