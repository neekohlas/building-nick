'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { ActivityCard } from './activity-card'
import { ActivityDetailModal } from './activity-detail-modal'
import { SwapModal } from './swap-modal'
import { PushModal, FutureOccurrence } from './push-modal'
import { Celebration } from './celebration'
import { AddActivityModal } from './add-activity-modal'
import { WeatherDetailModal } from './weather-detail-modal'
import { Button } from '@/components/ui/button'
import { HealthCoachModal } from './health-coach-modal'
import { CalendarClock, Plus, GripVertical, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Activity,
  CATEGORIES,
  TimeBlock
} from '@/lib/activities'
import { useActivities } from '@/hooks/use-activities'
import { useWeather, getWeatherEmoji, formatTemp, isBadWeatherForOutdoor, WeatherDay, WeatherHour } from '@/hooks/use-weather'
import { useCalendar } from '@/hooks/use-calendar'
import { CalendarEventCard } from './calendar-event-card'
import { ReminderCard, OverdueRemindersSection } from './reminder-card'
import { RemindersSyncModal } from './reminders-sync-modal'
import {
  getRemindersForTimeBlock,
  getOverdueReminders,
  checkForShortcutReturn,
  clearShortcutParam,
  getStoredReminders,
  type Reminder
} from '@/lib/reminders'
import { formatDateISO, shouldShowProfessionalGoals, formatDuration, formatDateFriendly } from '@/lib/date-utils'
import { getRandomMessage, getStreakMessage, pickRandom } from '@/lib/messages'
import { DailySchedule, Completion } from '@/hooks/use-storage'
import { useSync } from '@/hooks/use-sync'
import { useNotificationScheduler } from '@/hooks/use-notifications'

interface TodayViewProps {
  onOpenMenu: () => void
  snapToTodayKey?: number
  onAddCoachSuggestions?: (activityIds: string[]) => void
  onFocusForWeek?: (activityIds: string[]) => void
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

// Convert time block to hours (decimal) for current time calculation
const TIME_BLOCK_HOURS: Record<TimeBlock, number> = {
  before6am: 6,
  before9am: 9,
  beforeNoon: 12,
  before230pm: 14.5,
  before5pm: 17,
  before9pm: 21,
  // Legacy blocks
  before12pm: 12,
  before3pm: 15,
  before6pm: 18,
  before12am: 24
}

// Helper to create instance key for completion tracking
const getInstanceKey = (activityId: string, timeBlock: string, index: number) =>
  `${activityId}_${timeBlock}_${index}`

export function TodayView({ onOpenMenu, snapToTodayKey, onAddCoachSuggestions, onFocusForWeek }: TodayViewProps) {
  const storage = useSync()
  const { getActivity, getQuickMindBodyActivities } = useActivities()
  const { weather, getWeatherForDate, getHourlyForDate, locationName, isLoading: weatherLoading, error: weatherError } = useWeather()
  const { isConnected: calendarConnected, getEventsForTimeBlock, formatEventTime, getEventDuration } = useCalendar()
  const [schedule, setSchedule] = useState<DailySchedule | null>(null)
  // Instance-based completion tracking: keys are `${activityId}_${timeBlock}_${index}`
  const [completedInstanceKeys, setCompletedInstanceKeys] = useState<Set<string>>(new Set())
  // Full completion objects for notifications
  const [completions, setCompletions] = useState<Completion[]>([])
  const [motivation, setMotivation] = useState('')
  const [streak, setStreak] = useState(0)

  // Modal states
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [selectedTimeBlock, setSelectedTimeBlock] = useState<TimeBlock | null>(null)
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState<number>(0)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapActivity, setSwapActivity] = useState<Activity | null>(null)
  const [showCelebration, setShowCelebration] = useState(false)
  const [showPushModal, setShowPushModal] = useState(false)
  const [pushActivity, setPushActivity] = useState<Activity | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addActivityDefaultBlock, setAddActivityDefaultBlock] = useState<TimeBlock | null>(null)
  const [showWeatherDetail, setShowWeatherDetail] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [deleteConfirmActivity, setDeleteConfirmActivity] = useState<{ id: string; name: string; block: TimeBlock } | null>(null)

  // Health Coach state
  const [showHealthCoach, setShowHealthCoach] = useState(false)

  // Reminders state
  const [overdueReminders, setOverdueReminders] = useState<Reminder[]>([])
  const [remindersRefreshKey, setRemindersRefreshKey] = useState(0)
  const [showRemindersSyncModal, setShowRemindersSyncModal] = useState(false)

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

  // Date navigation state
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [snapAnimation, setSnapAnimation] = useState<'snap-to-today-from-future' | 'snap-to-today-from-past' | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)

  // Current time indicator
  const [currentTimePosition, setCurrentTimePosition] = useState<{ top: number; visible: boolean } | null>(null)
  const timeDividerRefs = useRef<Record<TimeBlock, HTMLDivElement | null>>({
    before6am: null,
    before9am: null,
    beforeNoon: null,
    before230pm: null,
    before5pm: null,
    before9pm: null,
    before12pm: null,
    before3pm: null,
    before6pm: null,
    before12am: null
  })
  const scheduleContainerRef = useRef<HTMLDivElement | null>(null)

  const dateStr = formatDateISO(selectedDate)
  const isToday = formatDateISO(new Date()) === dateStr

  // Build activity names map for notifications
  const activityNames = useMemo(() => {
    if (!schedule) return {}
    const names: Record<string, string> = {}
    for (const block of TIME_BLOCKS) {
      const activities = schedule.activities[block] || []
      for (const activityId of activities) {
        const activity = getActivity(activityId)
        if (activity) {
          names[activityId] = activity.name
        }
      }
    }
    return names
  }, [schedule, getActivity])

  // Notification scheduler - only active when viewing today
  useNotificationScheduler(
    isToday ? schedule : null,
    isToday ? completions : [],
    activityNames
  )

  // Navigate to previous/next day
  const navigateToPreviousDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() - 1)
      return newDate
    })
    hasLoadedRef.current = false // Allow reloading data for new date
  }

  const navigateToNextDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + 1)
      return newDate
    })
    hasLoadedRef.current = false // Allow reloading data for new date
  }

  // Snap to today with animation (triggered by bottom nav Today tab)
  const snapToToday = () => {
    if (isToday) {
      // Already on today — just scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Determine direction: if viewing future, slide content right (going back to today)
    // If viewing past, slide content left (going forward to today)
    const today = new Date()
    const direction = selectedDate > today ? 'snap-to-today-from-future' : 'snap-to-today-from-past'

    setSnapAnimation(direction)

    // Switch date and scroll to top during the animation
    setTimeout(() => {
      setSelectedDate(new Date())
      hasLoadedRef.current = false
      window.scrollTo({ top: 0, behavior: 'instant' })
    }, 150)

    // Clear animation after it completes
    setTimeout(() => setSnapAnimation(null), 400)
  }

  // Watch for external "snap to today" signal (e.g. bottom nav Today tab tapped)
  const snapToTodayKeyRef = useRef(snapToTodayKey)
  useEffect(() => {
    // Skip the initial render
    if (snapToTodayKey !== undefined && snapToTodayKey !== snapToTodayKeyRef.current) {
      snapToTodayKeyRef.current = snapToTodayKey
      snapToToday()
    }
  }, [snapToTodayKey])

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = () => {
    const diff = touchEndX.current - touchStartX.current
    const threshold = 100 // Minimum swipe distance (increased to avoid accidental navigation)

    // Only navigate if there was a clear horizontal swipe (not just a tap)
    if (touchEndX.current !== 0 && Math.abs(diff) > threshold) {
      if (diff > 0) {
        navigateToPreviousDay() // Swipe right = go to previous day
      } else {
        navigateToNextDay() // Swipe left = go to next day
      }
    }

    // Reset
    touchStartX.current = 0
    touchEndX.current = 0
  }

  // Format the date header
  const getDateHeaderLabel = () => {
    const today = new Date()
    const todayStr = formatDateISO(today)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatDateISO(yesterday)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatDateISO(tomorrow)

    if (dateStr === todayStr) return 'Today'
    if (dateStr === yesterdayStr) return 'Yesterday'
    if (dateStr === tomorrowStr) return 'Tomorrow'

    return formatDateFriendly(selectedDate)
  }

  // Generate daily schedule (fallback when no plan exists)
  const generateSchedule = useCallback((): DailySchedule => {
    const isProfessionalDay = shouldShowProfessionalGoals(selectedDate)

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
  }, [selectedDate, dateStr, getQuickMindBodyActivities])

  // Load data - only run once when storage becomes ready
  // Using a ref to track if we've already loaded to prevent re-runs
  const hasLoadedRef = useRef(false)

  useEffect(() => {
    if (!storage.isReady) return
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    async function loadData() {
      // Get or generate schedule
      let existingSchedule = await storage.getDailySchedule(dateStr)

      if (!existingSchedule) {
        existingSchedule = generateSchedule()
        await storage.saveDailySchedule(existingSchedule)
      }

      setSchedule(existingSchedule)

      // Get completions (instance-based)
      const loadedCompletions = await storage.getCompletionsForDate(dateStr)
      // Build instance keys from completions
      setCompletedInstanceKeys(new Set(
        loadedCompletions.map(c => getInstanceKey(c.activityId, c.timeBlock, c.instanceIndex ?? 0))
      ))
      // Store full completions for notifications
      setCompletions(loadedCompletions)

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
  // Re-run when date changes or storage becomes ready
  }, [storage.isReady, dateStr, generateSchedule, storage])

  // Track last processed pull time to avoid re-processing
  const lastProcessedPullTimeRef = useRef<Date | null>(null)

  // Re-fetch data when cloud sync pulls new data
  useEffect(() => {
    if (!storage.lastPullTime || !storage.isReady) return

    // Skip if we've already processed this pull time
    if (lastProcessedPullTimeRef.current?.getTime() === storage.lastPullTime.getTime()) {
      return
    }
    lastProcessedPullTimeRef.current = storage.lastPullTime

    async function refreshFromCloud() {
      console.log('[TodayView] Cloud data pulled, refreshing...')

      // Re-fetch schedule for current date
      const cloudSchedule = await storage.getDailySchedule(dateStr)
      if (cloudSchedule) {
        setSchedule(cloudSchedule)
      }

      // Re-fetch completions for current date (instance-based)
      const refreshedCompletions = await storage.getCompletionsForDate(dateStr)
      setCompletedInstanceKeys(new Set(
        refreshedCompletions.map(c => getInstanceKey(c.activityId, c.timeBlock, c.instanceIndex ?? 0))
      ))
      // Store full completions for notifications
      setCompletions(refreshedCompletions)

      // Re-fetch streak
      const currentStreak = await storage.getCurrentStreak()
      setStreak(currentStreak)
    }

    refreshFromCloud()
  }, [storage.lastPullTime, storage.isReady, dateStr, storage])

  // Load overdue reminders when date changes or after sync
  useEffect(() => {
    const overdue = getOverdueReminders(selectedDate)
    const allReminders = getStoredReminders()
    console.log('[TodayView] Reminders refresh:', {
      totalStored: allReminders.length,
      overdueCount: overdue.length,
      selectedDate: selectedDate.toISOString(),
      refreshKey: remindersRefreshKey
    })
    setOverdueReminders(overdue)
  }, [selectedDate, remindersRefreshKey])

  // Check for return from Reminders sync shortcut
  useEffect(() => {
    if (!checkForShortcutReturn()) return

    // Show the sync modal which will handle clipboard reading
    setShowRemindersSyncModal(true)
    // Clear the URL param
    clearShortcutParam()
  }, [])

  // Handle reminder completion toggle (sync-aware)
  const handleToggleReminderComplete = useCallback((reminderId: string) => {
    storage.toggleReminderCompletion(reminderId)
    setRemindersRefreshKey(k => k + 1)
  }, [storage])

  // Calculate current time indicator position
  useEffect(() => {
    if (!isToday) {
      setCurrentTimePosition(null)
      return
    }

    const calculateTimePosition = () => {
      const now = new Date()
      const currentHour = now.getHours() + now.getMinutes() / 60

      // Find which two time blocks the current time falls between
      let prevBlock: TimeBlock | null = null
      let nextBlock: TimeBlock | null = null

      for (let i = 0; i < TIME_BLOCKS.length; i++) {
        const blockHour = TIME_BLOCK_HOURS[TIME_BLOCKS[i]]
        if (currentHour < blockHour) {
          nextBlock = TIME_BLOCKS[i]
          prevBlock = i > 0 ? TIME_BLOCKS[i - 1] : null
          break
        }
      }

      // If current time is after the last block, hide indicator
      if (!nextBlock) {
        setCurrentTimePosition({ top: 0, visible: false })
        return
      }

      // Get the DOM elements for the time dividers
      const nextDivider = timeDividerRefs.current[nextBlock]
      const prevDivider = prevBlock ? timeDividerRefs.current[prevBlock] : null
      const container = scheduleContainerRef.current

      if (!nextDivider || !container) {
        setCurrentTimePosition(null)
        return
      }

      const containerRect = container.getBoundingClientRect()
      const nextRect = nextDivider.getBoundingClientRect()

      if (prevDivider) {
        const prevRect = prevDivider.getBoundingClientRect()
        const prevHour = TIME_BLOCK_HOURS[prevBlock!]
        const nextHour = TIME_BLOCK_HOURS[nextBlock]

        // Calculate the ratio of where current time falls between prev and next
        const ratio = (currentHour - prevHour) / (nextHour - prevHour)

        // Calculate position between the two dividers
        const prevTop = prevRect.top - containerRect.top + prevRect.height / 2
        const nextTop = nextRect.top - containerRect.top + nextRect.height / 2
        const top = prevTop + (nextTop - prevTop) * ratio

        setCurrentTimePosition({ top, visible: true })
      } else {
        // Before first time block - position above the first divider
        const nextHour = TIME_BLOCK_HOURS[nextBlock]
        // Assume day starts at midnight (0) for calculation
        const ratio = currentHour / nextHour
        const nextTop = nextRect.top - containerRect.top + nextRect.height / 2
        // Position it proportionally from top of container to first divider
        const top = nextTop * ratio

        setCurrentTimePosition({ top: Math.max(0, top), visible: true })
      }
    }

    // Calculate after a brief delay to ensure layout is complete
    const initialTimeout = setTimeout(calculateTimePosition, 100)

    // Also recalculate after a longer delay for any async content
    const secondTimeout = setTimeout(calculateTimePosition, 500)

    // Update every minute
    const interval = setInterval(calculateTimePosition, 60000)

    // Also recalculate on scroll/resize since positions may change
    const handleResize = () => calculateTimePosition()
    window.addEventListener('resize', handleResize)

    return () => {
      clearTimeout(initialTimeout)
      clearTimeout(secondTimeout)
      clearInterval(interval)
      window.removeEventListener('resize', handleResize)
    }
  }, [isToday, schedule]) // Recalculate when schedule changes (affects layout)

  // Toggle completion (instance-based)
  const handleToggleComplete = async (activityId: string, timeBlock: TimeBlock, instanceIndex: number, durationMinutes?: number) => {
    if (!storage.isReady) return

    const instanceKey = getInstanceKey(activityId, timeBlock, instanceIndex)
    const isCompleted = completedInstanceKeys.has(instanceKey)

    if (isCompleted) {
      await storage.removeCompletion(dateStr, activityId, timeBlock, instanceIndex)
      setCompletedInstanceKeys(prev => {
        const next = new Set(prev)
        next.delete(instanceKey)
        return next
      })
    } else {
      await storage.saveCompletion({
        date: dateStr,
        activityId,
        timeBlock,
        instanceIndex,
        ...(durationMinutes != null ? { durationMinutes } : {})
      })
      setCompletedInstanceKeys(prev => new Set([...prev, instanceKey]))
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

  // Remove activity from schedule
  const handleRemoveActivity = async (activityId: string, timeBlock?: TimeBlock) => {
    if (!schedule) return

    // Find which time block the activity is in if not provided
    let activityTimeBlock: TimeBlock | null = timeBlock || null
    if (!activityTimeBlock) {
      for (const block of Object.keys(schedule.activities) as TimeBlock[]) {
        if (schedule.activities[block].includes(activityId)) {
          activityTimeBlock = block
          break
        }
      }
    }
    if (!activityTimeBlock) return

    // Remove from schedule
    const newSchedule: DailySchedule = {
      ...schedule,
      activities: {
        ...schedule.activities,
        [activityTimeBlock]: schedule.activities[activityTimeBlock].filter(
          id => id !== activityId
        )
      }
    }
    await storage.saveDailySchedule(newSchedule)
    setSchedule(newSchedule)
    setSelectedActivity(null)
    setDeleteConfirmActivity(null)
  }

  // Get next day's date string relative to selected date
  const getNextDayDateStr = () => {
    const nextDay = new Date(selectedDate)
    nextDay.setDate(nextDay.getDate() + 1)
    return nextDay.toISOString().split('T')[0]
  }

  // Helper function to push a single activity from one date to the next
  const pushActivityOneDay = async (
    activityId: string,
    fromDateStr: string,
    timeBlock: TimeBlock
  ): Promise<void> => {
    const nextDate = new Date(fromDateStr)
    nextDate.setDate(nextDate.getDate() + 1)
    const toDateStr = nextDate.toISOString().split('T')[0]

    // Get current schedule for from date
    const fromSchedule = await storage.getDailySchedule(fromDateStr)
    if (!fromSchedule) return

    // Remove from fromDate
    const newFromSchedule: DailySchedule = {
      ...fromSchedule,
      activities: {
        ...fromSchedule.activities,
        [timeBlock]: fromSchedule.activities[timeBlock]?.filter(id => id !== activityId) || []
      }
    }
    await storage.saveDailySchedule(newFromSchedule)

    // Add to toDate
    let toSchedule = await storage.getDailySchedule(toDateStr)
    if (!toSchedule) {
      toSchedule = {
        date: toDateStr,
        activities: { before6am: [], before9am: [], beforeNoon: [], before230pm: [], before5pm: [], before9pm: [] }
      }
    }
    if (!toSchedule.activities[timeBlock]) {
      toSchedule.activities[timeBlock] = []
    }
    // Only add if not already there
    if (!toSchedule.activities[timeBlock].includes(activityId)) {
      toSchedule.activities[timeBlock] = [...toSchedule.activities[timeBlock], activityId]
    }
    await storage.saveDailySchedule(toSchedule)
  }

  // Push single activity to tomorrow (with optional future cascade)
  const handlePushSingle = async (futurePushes: FutureOccurrence[] = []) => {
    if (!schedule || !pushActivity) return

    const tomorrowStr = getNextDayDateStr()

    // Find which time block the activity is in today
    let activityTimeBlock: TimeBlock | null = null
    for (const block of Object.keys(schedule.activities) as TimeBlock[]) {
      if (schedule.activities[block].includes(pushActivity.id)) {
        activityTimeBlock = block
        break
      }
    }
    if (!activityTimeBlock) return

    // 1. Push today's occurrence to tomorrow
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
    if (!tomorrowSchedule.activities[activityTimeBlock]) {
      tomorrowSchedule.activities[activityTimeBlock] = []
    }
    // Only add if not already there
    if (!tomorrowSchedule.activities[activityTimeBlock].includes(pushActivity.id)) {
      tomorrowSchedule.activities[activityTimeBlock] = [
        ...tomorrowSchedule.activities[activityTimeBlock],
        pushActivity.id
      ]
    }
    await storage.saveDailySchedule(tomorrowSchedule)

    // 2. Push selected future occurrences (process in reverse order to avoid conflicts)
    // Sort by date descending so we process the furthest date first
    const sortedFuturePushes = [...futurePushes].sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )

    for (const futureOcc of sortedFuturePushes) {
      await pushActivityOneDay(pushActivity.id, futureOcc.date, futureOcc.timeBlock)
    }

    setShowPushModal(false)
    setPushActivity(null)
  }

  // Push all incomplete activities to tomorrow
  const handlePushAllIncomplete = async () => {
    if (!schedule) return

    const tomorrowStr = getNextDayDateStr()
    
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
      const activities = schedule.activities[block] || []
      for (let i = 0; i < activities.length; i++) {
        const activityId = activities[i]
        const instanceKey = getInstanceKey(activityId, block, i)
        if (completedInstanceKeys.has(instanceKey)) {
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
  // Note: We allow adding the same activity multiple times (same or different time blocks)
  // in case the user wants to do it multiple times per day
  // With instance-based tracking, each new instance starts uncompleted
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
    setAddActivityDefaultBlock(null)
  }

  // Handle "Add to Today" from Health Coach
  const handleCoachAddToToday = async (activityIds: string[]) => {
    if (activityIds.length === 0 || !schedule) return

    const hour = new Date().getHours()
    let timeBlock: TimeBlock = 'before9pm'
    if (hour < 6) timeBlock = 'before6am'
    else if (hour < 9) timeBlock = 'before9am'
    else if (hour < 12) timeBlock = 'beforeNoon'
    else if (hour < 14.5) timeBlock = 'before230pm'
    else if (hour < 17) timeBlock = 'before5pm'

    const existingInBlock = schedule.activities[timeBlock] || []
    const newActivities = activityIds.filter(id => !existingInBlock.includes(id))

    if (newActivities.length > 0) {
      const newSchedule: DailySchedule = {
        ...schedule,
        activities: {
          ...schedule.activities,
          [timeBlock]: [...existingInBlock, ...newActivities]
        }
      }
      await storage.saveDailySchedule(newSchedule)
      setSchedule(newSchedule)
    }

    setShowHealthCoach(false)
  }

  // Calculate drop target from Y position
  const getDropTargetFromY = (y: number): { block: TimeBlock; index: number } | null => {
    if (!schedule) return null

    // Build an array of block rects with their midpoints for zone-based detection
    // Each block "owns" the vertical space from its midpoint to the next block's midpoint
    const blockZones: { block: TimeBlock; top: number; bottom: number }[] = []
    const blockRects: { block: TimeBlock; rect: DOMRect }[] = []

    for (const block of TIME_BLOCKS) {
      const el = blockRefs.current[block]
      if (!el) continue
      blockRects.push({ block, rect: el.getBoundingClientRect() })
    }

    for (let i = 0; i < blockRects.length; i++) {
      const { block, rect } = blockRects[i]
      // Zone top = midpoint between this block's top and previous block's bottom (or 0)
      const zoneTop = i === 0 ? 0 : (blockRects[i - 1].rect.bottom + rect.top) / 2
      // Zone bottom = midpoint between this block's bottom and next block's top (or Infinity)
      const zoneBottom = i === blockRects.length - 1 ? Infinity : (rect.bottom + blockRects[i + 1].rect.top) / 2

      blockZones.push({ block, top: zoneTop, bottom: zoneBottom })
    }

    // Find which block zone the Y coordinate falls in
    for (const zone of blockZones) {
      if (y >= zone.top && y < zone.bottom) {
        const activities = schedule.activities[zone.block] || []
        let insertIndex = activities.length // Default: insert at end (works for empty blocks too)

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

    // Fallback: last block
    const lastBlock = TIME_BLOCKS[TIME_BLOCKS.length - 1]
    const activities = schedule.activities[lastBlock] || []
    return { block: lastBlock, index: activities.length }
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

  // Calculate incomplete count - instance-based, only count activities that actually exist
  const incompleteCount = schedule
    ? Object.entries(schedule.activities).reduce((count, [block, activities]) => {
        return count + (activities || []).filter((activityId, index) => {
          const activity = getActivity(activityId)
          const instanceKey = getInstanceKey(activityId, block, index)
          return activity && !completedInstanceKeys.has(instanceKey)
        }).length
      }, 0)
    : 0

  // Calculate progress - instance-based, only count activities that actually exist
  const totalActivities = schedule
    ? Object.values(schedule.activities).flat().filter(id => getActivity(id)).length
    : 0
  const completedCount = schedule
    ? Object.entries(schedule.activities).reduce((count, [block, activities]) => {
        return count + (activities || []).filter((activityId, index) => {
          const activity = getActivity(activityId)
          const instanceKey = getInstanceKey(activityId, block, index)
          return activity && completedInstanceKeys.has(instanceKey)
        }).length
      }, 0)
    : 0

  if (!schedule) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading your plan...</p>
      </div>
    )
  }

  // Get selected date's weather
  // OpenWeather 2.5 API (fallback) may not include today in forecasts - use first available day as fallback
  const exactDateWeather = getWeatherForDate(dateStr)
  const selectedDateWeather = exactDateWeather || (
    isToday && weather?.daily?.[0] ? weather.daily[0] : undefined
  )
  const hasOutdoorActivities = schedule && Object.values(schedule.activities).flat().some(id => {
    const activity = getActivity(id)
    return activity?.outdoor || activity?.weatherDependent
  })
  const badWeatherWarning = selectedDateWeather && isBadWeatherForOutdoor(selectedDateWeather) && hasOutdoorActivities

  return (
    <div
      ref={contentRef}
      className={cn("space-y-6", snapAnimation)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Edit Mode Banner - sticky at top when reordering */}
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

      {/* Date Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={navigateToPreviousDay}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div
          className={cn(
            "px-4 py-2 rounded-full text-center",
            isToday && "bg-primary/10 text-primary font-semibold"
          )}
        >
          <span className="text-lg font-semibold">{getDateHeaderLabel()}</span>
        </div>

        <button
          onClick={navigateToNextDay}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Weather + Motivation Card */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {weatherLoading ? (
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
            <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="w-16 h-5 bg-muted animate-pulse rounded" />
              <div className="w-24 h-4 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ) : selectedDateWeather ? (
          <button
            onClick={() => setShowWeatherDetail(true)}
            className="w-full flex items-center gap-3 mb-3 pb-3 border-b border-border hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors text-left"
          >
            <span className="text-3xl">{getWeatherEmoji(selectedDateWeather.weather.main, selectedDateWeather.weather.id)}</span>
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-semibold">{formatTemp(selectedDateWeather.temp.max)}</span>
                <span className="text-sm text-muted-foreground">/ {formatTemp(selectedDateWeather.temp.min)}</span>
              </div>
              <p className="text-sm text-muted-foreground capitalize">{selectedDateWeather.weather.description}</p>
            </div>
            {selectedDateWeather.pop > 0.1 && (
              <div className="text-right">
                <span className="text-blue-500 font-medium">{Math.round(selectedDateWeather.pop * 100)}%</span>
                <p className="text-xs text-muted-foreground">rain</p>
              </div>
            )}
          </button>
        ) : weather?.daily && weather.daily.length > 0 ? (
          // Weather loaded but no forecast for this specific date (e.g., viewing past/far future date)
          <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border text-muted-foreground">
            <span className="text-2xl">📅</span>
            <p className="text-sm">Weather forecast not available for this date</p>
          </div>
        ) : null}
        {badWeatherWarning && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
            ⚠️ Outdoor activities may be affected by weather today
          </div>
        )}
        <p className="text-lg font-medium leading-relaxed text-foreground font-sans" suppressHydrationWarning>
          {motivation || '\u00A0'}
        </p>
      </div>

      {/* Overdue Reminders Section */}
      {overdueReminders.length > 0 && (
        <OverdueRemindersSection
          reminders={overdueReminders}
          onToggleComplete={handleToggleReminderComplete}
        />
      )}

      {/* Daily Plan - Activities appear ABOVE their deadline time */}
      <div className="space-y-2 relative" ref={scheduleContainerRef}>
        {/* Current time indicator */}
        {currentTimePosition?.visible && (
          <div
            className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
            style={{ top: currentTimePosition.top }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="flex-1 h-0.5 bg-red-500" />
          </div>
        )}
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

              {/* Calendar events for this time block */}
              {calendarConnected && (() => {
                const calendarEvents = getEventsForTimeBlock(dateStr, block)
                return calendarEvents.length > 0 ? (
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
                ) : null
              })()}

              {/* Reminders for this time block */}
              {(() => {
                const blockReminders = getRemindersForTimeBlock(selectedDate, block)
                return blockReminders.length > 0 ? (
                  <div className="space-y-2 mb-2">
                    {blockReminders.map(reminder => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        onToggleComplete={() => handleToggleReminderComplete(reminder.id)}
                      />
                    ))}
                  </div>
                ) : null
              })()}

              {/* Activities for this time block */}
              {hasActivities ? (
                <div className="space-y-2">
                  {activities.map((activityId, index) => {
                    const activity = getActivity(activityId)
                    if (!activity) return null

                    const isDragging = dragState?.activityId === activityId && dragState?.isDragging
                    // Use index in key to allow same activity multiple times
                    const itemKey = `${block}-${activityId}-${index}`

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

                          {/* Activity card */}
                          <div className="flex-1">
                            <ActivityCard
                              activity={activity}
                              isCompleted={completedInstanceKeys.has(getInstanceKey(activityId, block, index))}
                              timeBlock={block}
                              onToggleComplete={() => handleToggleComplete(activityId, block, index)}
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
                                setSelectedInstanceIndex(index)
                              }}
                              onReorder={() => setIsEditMode(true)}
                              onDelete={() => setDeleteConfirmActivity({ id: activityId, name: activity.name, block })}
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
              <div
                className="flex items-center gap-3 py-3"
                ref={el => { timeDividerRefs.current[block] = el }}
              >
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {deadlineLabel}
                </span>
                <div className="flex-1 h-px bg-border" />
                <button
                  onClick={() => {
                    // The + button is on the divider AFTER a time block, so clicking it
                    // should add to the NEXT time block (the one that starts at this time)
                    const nextBlockIndex = blockIndex + 1
                    const nextBlock = TIME_BLOCKS[nextBlockIndex] || block
                    setAddActivityDefaultBlock(nextBlock)
                    setShowAddModal(true)
                  }}
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
        onClick={() => {
          setAddActivityDefaultBlock(null)
          setShowAddModal(true)
        }}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Activity
      </Button>

      {/* Push All Incomplete Button */}
      {incompleteCount > 1 && (
        <Button
          variant="outline"
          className="w-full bg-transparent"
          onClick={() => {
            setPushActivity(null)
            setShowPushModal(true)
          }}
        >
          <CalendarClock className="h-4 w-4 mr-2" />
          Push {incompleteCount} Incomplete to {isToday ? 'Tomorrow' : 'Next Day'}
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

      {/* Floating Health Coach Button */}
      <button
        onClick={() => setShowHealthCoach(true)}
        className="fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="Health Coach"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Health Coach Modal */}
      {showHealthCoach && (
        <HealthCoachModal
          onClose={() => setShowHealthCoach(false)}
          onAddToToday={(activityIds) => {
            handleCoachAddToToday(activityIds)
          }}
          onDoItNow={async (activityId) => {
            // Add to today's current time block
            await handleCoachAddToToday([activityId])
            // Open the activity detail modal
            const activity = getActivity(activityId)
            if (activity) {
              const hour = new Date().getHours()
              let timeBlock: TimeBlock = 'before9pm'
              if (hour < 6) timeBlock = 'before6am'
              else if (hour < 9) timeBlock = 'before9am'
              else if (hour < 12) timeBlock = 'beforeNoon'
              else if (hour < 14.5) timeBlock = 'before230pm'
              else if (hour < 17) timeBlock = 'before5pm'
              setSelectedActivity(activity)
              setSelectedTimeBlock(timeBlock)
              setSelectedInstanceIndex(0)
            }
          }}
          onFocusForWeek={(activityIds) => {
            setShowHealthCoach(false)
            if (onFocusForWeek) onFocusForWeek(activityIds)
          }}
        />
      )}

      {/* Activity Detail Modal */}
      {selectedActivity && !showSwapModal && (
        <ActivityDetailModal
          activity={selectedActivity}
          isCompleted={selectedTimeBlock ? completedInstanceKeys.has(getInstanceKey(selectedActivity.id, selectedTimeBlock, selectedInstanceIndex)) : false}
          onClose={() => setSelectedActivity(null)}
          onComplete={(durationMinutes) => {
            if (selectedTimeBlock) {
              handleToggleComplete(selectedActivity.id, selectedTimeBlock, selectedInstanceIndex, durationMinutes)
            }
            setSelectedActivity(null)
          }}
          onDurationChange={(durationMinutes) => {
            if (selectedTimeBlock) {
              storage.updateCompletionDuration(dateStr, selectedActivity.id, selectedTimeBlock, selectedInstanceIndex, durationMinutes)
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
          onRemove={() => handleRemoveActivity(selectedActivity.id)}
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
          incompleteCount={incompleteCount}
          currentDate={dateStr}
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
          targetDate={selectedDate}
          defaultTimeBlock={addActivityDefaultBlock}
          onClose={() => {
            setShowAddModal(false)
            setAddActivityDefaultBlock(null)
          }}
          onAdd={handleAddActivity}
        />
      )}

      {/* Celebration */}
      <Celebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {/* Weather Detail Modal */}
      {showWeatherDetail && selectedDateWeather && (
        <WeatherDetailModal
          weather={selectedDateWeather}
          hourly={getHourlyForDate(dateStr)}
          locationName={locationName}
          onClose={() => setShowWeatherDetail(false)}
        />
      )}

      {/* Reminders Sync Modal */}
      {showRemindersSyncModal && (
        <RemindersSyncModal
          onClose={() => setShowRemindersSyncModal(false)}
          onSyncComplete={() => {
            setRemindersRefreshKey(k => k + 1)
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
              Remove <span className="font-medium text-foreground">{deleteConfirmActivity.name}</span> from today's schedule?
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
