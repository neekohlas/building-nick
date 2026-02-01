'use client'

import React, { useRef } from "react"

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Check, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Sparkles, Search,
  ArrowUpDown, Clock, ArrowRightLeft, X, Info,
  Zap, Leaf, Plus, GripVertical, Star, RefreshCw, ExternalLink, Play, Video, Volume2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ACTIVITIES,
  CATEGORIES,
  getAllActivities,
  getVariantsForActivity,
  type Activity,
  type PlanFrequency,
  type ActivitySelection,
  type Category
} from '@/lib/activities'
import { DailySchedule, SavedPlanConfig } from '@/hooks/use-storage'
import { useSync } from '@/hooks/use-sync'
import { useActivities } from '@/hooks/use-activities'
import { useWeather, getWeatherEmoji, formatTemp, isBadWeatherForOutdoor } from '@/hooks/use-weather'
import { useCalendar } from '@/hooks/use-calendar'
import { CalendarEventListItem } from './calendar-event-card'
import { HealthCoachModal } from './health-coach-modal'
import { SpectrumBar } from './spectrum-bar'
import { hasMultipleSteps } from '@/hooks/use-audio-instructions'
import { formatDateISO, addDays, isWeekday, getShortDayName, getDayNumber } from '@/lib/date-utils'

interface PlanWeekViewProps {
  onComplete: () => void
  onBack: () => void
  preSelectedActivities?: string[]
}

type TimeBlock = 'before6am' | 'before9am' | 'before12pm' | 'before3pm' | 'before5pm' | 'before6pm' | 'before9pm' | 'before12am' | 'beforeNoon' | 'before230pm'
type DayTemplate = {
  before6am: string[]
  before9am: string[]
  before12pm: string[]
  before3pm: string[]
  before5pm: string[]
  before6pm: string[]
  before9pm: string[]
  before12am: string[]
  beforeNoon: string[]
  before230pm: string[]
}

// New step flow
type PlanStep =
  | 'select_activities'  // Step 1: Pick activities with frequency
  | 'tomorrow_type'      // Step 2: Heavy or Light for tomorrow
  | 'design_tomorrow'    // Step 3: Edit picked day type template
  | 'design_alternate'   // Step 4: Edit other day type template
  | 'preview'            // Step 5: See the full 7-day plan
  | 'done'               // Step 6: Save confirmation

const TIME_BLOCKS: TimeBlock[] = ['before6am', 'before9am', 'before12pm', 'before3pm', 'before5pm', 'before6pm', 'before9pm', 'before12am', 'beforeNoon', 'before230pm']

// Only show the commonly used time blocks in UI
const VISIBLE_TIME_BLOCKS: TimeBlock[] = ['before6am', 'before9am', 'beforeNoon', 'before230pm', 'before5pm', 'before9pm']

// Labels shown as deadlines AFTER the activities for that time block
const TIME_BLOCK_DEADLINE_LABELS: Record<TimeBlock, string> = {
  before6am: '6 AM',
  before9am: '9 AM',
  before12pm: '12 PM',
  before3pm: '3 PM',
  before5pm: '5 PM',
  before6pm: '6 PM',
  before9pm: '9 PM',
  before12am: '12 AM',
  beforeNoon: '12 PM',
  before230pm: '2:30 PM'
}

const FREQUENCY_OPTIONS: { value: PlanFrequency; label: string }[] = [
  { value: 'heavy', label: 'Heavy days' },
  { value: 'light', label: 'Light days' },
  { value: 'everyday', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays only' },
  { value: 'weekends', label: 'Weekends only' },
  { value: 'custom', label: 'Custom...' }
]

const CATEGORY_ORDER: Category[] = ['physical', 'mind_body', 'professional']

export function PlanWeekView({ onComplete, onBack, preSelectedActivities = [] }: PlanWeekViewProps) {
  const storage = useSync()
  const { activities: notionActivities, isLoading: activitiesLoading, isSyncing, source: activitySource, syncFromNotion, getPlanableActivities } = useActivities()
  const { getWeatherForDate, hasBadWeather } = useWeather()
  const { isConnected: calendarConnected, getEventsForDate, getEventsForTimeBlock, formatEventTime } = useCalendar()

  // New step flow
  const [step, setStep] = useState<PlanStep>('select_activities')
  const [startWithHeavy, setStartWithHeavy] = useState<boolean>(true)

  // Activity selections (Step 1)
  const [selections, setSelections] = useState<ActivitySelection[]>([])
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['physical'])
  const [expandedVariants, setExpandedVariants] = useState<string[]>([])

  // Day templates - will be generated from selections
  const [heavyDay, setHeavyDay] = useState<DayTemplate>({
    before6am: [],
    before9am: [],
    before12pm: [],
    before3pm: [],
    before5pm: [],
    before6pm: [],
    before9pm: [],
    before12am: [],
    beforeNoon: [],
    before230pm: []
  })
  const [lightDay, setLightDay] = useState<DayTemplate>({
    before6am: [],
    before9am: [],
    before12pm: [],
    before3pm: [],
    before5pm: [],
    before6pm: [],
    before9pm: [],
    before12am: [],
    beforeNoon: [],
    before230pm: []
  })

  // Week data
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [generatedSchedules, setGeneratedSchedules] = useState<Record<string, DailySchedule>>({})

  // Preview state
  const [expandedDay, setExpandedDay] = useState<string | undefined>(undefined)
  const [swappingActivity, setSwappingActivity] = useState<{dateStr: string, activityId: string, timeBlock: TimeBlock} | null>(null)

  // Add activity in preview
  const [addToPreviewModal, setAddToPreviewModal] = useState<{dateStr: string, block: TimeBlock} | null>(null)

  // Activity detail view (for step 1)
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null)
  const [showActivityDetails, setShowActivityDetails] = useState(false)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)

  // Health Coach modal
  const [showHealthCoach, setShowHealthCoach] = useState(false)

  // Custom day picker modal
  const [customDayPickerActivity, setCustomDayPickerActivity] = useState<string | null>(null)

  // Saved plan config
  const [savedConfig, setSavedConfig] = useState<SavedPlanConfig | null>(null)
  const [loadingSavedConfig, setLoadingSavedConfig] = useState(true)

  // Touch drag state for template editing
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
    before12pm: null,
    before3pm: null,
    before5pm: null,
    before6pm: null,
    before9pm: null,
    before12am: null,
    beforeNoon: null,
    before230pm: null
  })
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Touch drag state for preview
  const [previewDragState, setPreviewDragState] = useState<{
    activityId: string
    sourceBlock: TimeBlock
    sourceIndex: number
    dateStr: string
    currentY: number
    startY: number
    isDragging: boolean
  } | null>(null)
  const [previewDropTarget, setPreviewDropTarget] = useState<{ block: TimeBlock; index: number } | null>(null)
  const previewBlockRefs = useRef<Record<TimeBlock, HTMLDivElement | null>>({
    before6am: null,
    before9am: null,
    before12pm: null,
    before3pm: null,
    before5pm: null,
    before6pm: null,
    before9pm: null,
    before12am: null,
    beforeNoon: null,
    before230pm: null
  })
  const previewItemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Clear item refs when templates change to avoid stale refs
  useEffect(() => {
    itemRefs.current.clear()
  }, [heavyDay, lightDay])

  // Clear preview item refs when schedules or expanded day changes
  useEffect(() => {
    previewItemRefs.current.clear()
  }, [generatedSchedules, expandedDay])

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  // Merged activities lookup - use Notion activities, fallback to local
  const allActivities = useMemo(() => {
    return { ...ACTIVITIES, ...notionActivities }
  }, [notionActivities])

  // Get activity by ID with fallback
  const getActivity = useCallback((id: string) => {
    return allActivities[id] || ACTIVITIES[id]
  }, [allActivities])

  // Get planable activities grouped by category
  // Use activities from Notion if available, otherwise use local
  const planableActivities = useMemo(() => getPlanableActivities(), [getPlanableActivities])

  const activitiesByCategory = useMemo(() => {
    const grouped: Record<Category, typeof planableActivities> = {
      physical: [],
      mind_body: [],
      professional: []
    }
    planableActivities.forEach(a => {
      if (grouped[a.category]) {
        grouped[a.category].push(a)
      }
    })
    // Sort each category: favorites first, then alphabetically by name
    Object.keys(grouped).forEach(key => {
      grouped[key as Category].sort((a, b) => {
        // Favorites come first
        if (a.favorite && !b.favorite) return -1
        if (!a.favorite && b.favorite) return 1
        // Then alphabetically
        return a.name.localeCompare(b.name)
      })
    })
    return grouped
  }, [planableActivities])

  // Generate week dates starting from tomorrow
  useEffect(() => {
    const dates: Date[] = []
    const tomorrow = addDays(new Date(), 1)
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(tomorrow, i))
    }
    setWeekDates(dates)
  }, [])

  // Load saved plan config on mount
  useEffect(() => {
    async function loadSavedConfig() {
      try {
        const config = await storage.getLastPlanConfig()
        setSavedConfig(config)
      } catch (e) {
        console.error('Failed to load saved plan config:', e)
      } finally {
        setLoadingSavedConfig(false)
      }
    }
    if (storage.isReady) {
      loadSavedConfig()
    }
  }, [storage.isReady, storage.getLastPlanConfig])

  // Apply pre-selected activities from Health Coach
  useEffect(() => {
    if (preSelectedActivities.length > 0 && !activitiesLoading) {
      // Add pre-selected activities to selections
      const newSelections: ActivitySelection[] = preSelectedActivities
        .filter(actId => getActivity(actId)) // Only include activities that exist
        .filter(actId => !selections.some(s => s.activityId === actId)) // Avoid duplicates
        .map(activityId => {
          const activity = getActivity(activityId)
          // Default to everyday for mind-body activities from Health Coach
          return { activityId, frequency: 'everyday' as PlanFrequency }
        })

      if (newSelections.length > 0) {
        setSelections(prev => [...prev, ...newSelections])
        // Expand mind_body category to show the selections
        if (!expandedCategories.includes('mind_body')) {
          setExpandedCategories(prev => [...prev, 'mind_body'])
        }
      }
    }
  }, [preSelectedActivities, activitiesLoading]) // Only run when preSelectedActivities changes or activities finish loading

  // Helper: check if activity should appear on a given day
  const shouldActivityAppear = useCallback((
    frequency: PlanFrequency,
    dayType: 'heavy' | 'light',
    isWeekdayDate: boolean
  ): boolean => {
    switch (frequency) {
      case 'heavy': return dayType === 'heavy'
      case 'light': return dayType === 'light'
      case 'everyday': return true
      case 'weekdays': return isWeekdayDate
      case 'weekends': return !isWeekdayDate
      case 'custom': return false  // Custom days have their own specific dates, not heavy/light templates
    }
  }, [])

  // Intelligently assign time block based on activity category and duration
  const getSmartTimeBlock = useCallback((activity: Activity): TimeBlock => {
    // If activity has explicit defaultTimeBlock from Notion, use it
    // But map new Notion time blocks to visible ones in UI
    if (activity.defaultTimeBlock) {
      const timeBlock = activity.defaultTimeBlock
      // Map some time blocks to the visible ones
      if (timeBlock === 'before12pm') return 'beforeNoon'
      if (timeBlock === 'before3pm' || timeBlock === 'before6pm') return 'before5pm'
      if (timeBlock === 'before12am') return 'before9pm'
      return timeBlock
    }

    // Smart distribution based on category
    if (activity.category === 'physical') {
      // Physical activities in the morning
      return 'before9am'
    } else if (activity.category === 'mind_body') {
      // Quick mind-body activities in early morning
      if (activity.quick || activity.duration <= 5) {
        return 'before6am'
      }
      // Longer mind-body in the evening
      return 'before9pm'
    } else if (activity.category === 'professional') {
      // Professional activities before noon
      return 'beforeNoon'
    }

    return 'before9pm'
  }, [])

  // Generate day template from selections
  const generateDayTemplate = useCallback((
    dayType: 'heavy' | 'light',
    isWeekdayDate: boolean = true
  ): DayTemplate => {
    const template: DayTemplate = {
      before6am: [],
      before9am: [],
      before12pm: [],
      before3pm: [],
      before5pm: [],
      before6pm: [],
      before9pm: [],
      before12am: [],
      beforeNoon: [],
      before230pm: []
    }

    for (const selection of selections) {
      const activity = getActivity(selection.activityId)
      if (!activity) continue

      if (shouldActivityAppear(selection.frequency, dayType, isWeekdayDate)) {
        const activityToAdd = selection.variantId || selection.activityId
        const timeBlock = getSmartTimeBlock(activity)
        template[timeBlock].push(activityToAdd)
      }
    }

    // Activities are added in selection order, which preserves user's intended sequence

    return template
  }, [selections, shouldActivityAppear, getSmartTimeBlock, getActivity])

  // Update templates when moving from step 1 to step 2
  const generateTemplatesFromSelections = useCallback(() => {
    const heavy = generateDayTemplate('heavy', true)
    const light = generateDayTemplate('light', true)
    setHeavyDay(heavy)
    setLightDay(light)
  }, [generateDayTemplate])

  // Generate schedules from heavy/light templates
  const generateSchedules = useCallback(() => {
    const schedules: Record<string, DailySchedule> = {}

    weekDates.forEach((date, index) => {
      const dateStr = formatDateISO(date)
      // Alternate based on startWithHeavy preference
      const isHeavyDay = startWithHeavy ? (index % 2 === 0) : (index % 2 === 1)
      const template = isHeavyDay ? heavyDay : lightDay
      const isWeekdayDate = isWeekday(date)

      // Clone template - only include visible time blocks for DailySchedule
      // Also merge legacy time blocks into their nearest visible equivalents
      const activities: DailySchedule['activities'] = {
        before6am: [...(template.before6am || [])],
        before9am: [...(template.before9am || [])],
        beforeNoon: [...(template.beforeNoon || []), ...(template.before12pm || [])],
        before230pm: [...(template.before230pm || []), ...(template.before3pm || [])],
        before5pm: [...(template.before5pm || []), ...(template.before6pm || [])],
        before9pm: [...(template.before9pm || []), ...(template.before12am || [])]
      }

      // Handle weekday-only activities (remove on weekends)
      if (!isWeekdayDate) {
        // For selections marked as weekdays, they won't be in template anyway
        // But we also need to handle any manually added weekday-only activities
        const weekdayOnlyIds = selections
          .filter(s => s.frequency === 'weekdays')
          .map(s => s.variantId || s.activityId)

        for (const block of VISIBLE_TIME_BLOCKS) {
          if (activities[block]) {
            activities[block] = activities[block].filter(id => !weekdayOnlyIds.includes(id))
          }
        }
      }

      // Handle weekend-only activities (remove on weekdays)
      if (isWeekdayDate) {
        const weekendOnlyIds = selections
          .filter(s => s.frequency === 'weekends')
          .map(s => s.variantId || s.activityId)

        for (const block of VISIBLE_TIME_BLOCKS) {
          if (activities[block]) {
            activities[block] = activities[block].filter(id => !weekendOnlyIds.includes(id))
          }
        }
      }

      // Handle custom frequency activities - only include on selected days
      const customSelections = selections.filter(s => s.frequency === 'custom')
      for (const customSel of customSelections) {
        const activityIdToCheck = customSel.variantId || customSel.activityId
        const isCustomDaySelected = customSel.customDays?.includes(dateStr)

        if (!isCustomDaySelected) {
          // Remove this activity from all time blocks for this day
          for (const block of VISIBLE_TIME_BLOCKS) {
            if (activities[block]) {
              activities[block] = activities[block].filter(id => id !== activityIdToCheck)
            }
          }
        } else {
          // Make sure it's added if it's a custom selected day
          // It might not be in template if it didn't match heavy/light days
          const activity = getActivity(activityIdToCheck)
          if (activity) {
            const timeBlock = getSmartTimeBlock(activity)
            const mappedBlock = (() => {
              if (timeBlock === 'before12pm') return 'beforeNoon'
              if (timeBlock === 'before3pm' || timeBlock === 'before6pm') return 'before5pm'
              if (timeBlock === 'before12am') return 'before9pm'
              return timeBlock as keyof DailySchedule['activities']
            })()
            if (!activities[mappedBlock]?.includes(activityIdToCheck)) {
              if (!activities[mappedBlock]) activities[mappedBlock] = []
              activities[mappedBlock].push(activityIdToCheck)
            }
          }
        }
      }

      schedules[dateStr] = { date: dateStr, activities }
      console.log('PlanWeekView: Generated schedule for', dateStr, activities)
    })

    console.log('PlanWeekView: All generated schedules:', Object.keys(schedules))
    setGeneratedSchedules(schedules)
    setStep('preview')
  }, [weekDates, heavyDay, lightDay, startWithHeavy, selections, getActivity, getSmartTimeBlock])

  // Save schedules with timeout fallback
  const saveSchedules = async () => {
    const schedules = Object.values(generatedSchedules)
    console.log('saveSchedules called', { scheduleCount: schedules.length })

    if (schedules.length === 0) {
      console.error('No schedules to save')
      alert('No schedules to save. Please go back and try again.')
      return
    }

    setIsSaving(true)

    // Create a timeout promise as fallback
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), 30000) // 30 second total timeout
    })

    try {
      // Save all schedules with timeout
      const savePromise = (async () => {
        for (const schedule of schedules) {
          console.log('Saving schedule for:', schedule.date)
          await storage.saveDailySchedule(schedule)
          console.log('Saved schedule for:', schedule.date)
        }

        // Also save the plan configuration for future recall
        const planConfig = {
          selectedActivities: selections.map(s => s.activityId),
          frequencies: selections.reduce((acc, s) => {
            acc[s.activityId] = s.frequency
            return acc
          }, {} as Record<string, 'everyday' | 'heavy' | 'light' | 'weekdays' | 'weekends'>),
          heavyDaySchedule: {
            before6am: heavyDay.before6am,
            before9am: heavyDay.before9am,
            beforeNoon: [...heavyDay.beforeNoon, ...heavyDay.before12pm],
            before230pm: [...heavyDay.before230pm, ...heavyDay.before3pm],
            before5pm: [...heavyDay.before5pm, ...heavyDay.before6pm],
            before9pm: [...heavyDay.before9pm, ...heavyDay.before12am]
          },
          lightDaySchedule: {
            before6am: lightDay.before6am,
            before9am: lightDay.before9am,
            beforeNoon: [...lightDay.beforeNoon, ...lightDay.before12pm],
            before230pm: [...lightDay.before230pm, ...lightDay.before3pm],
            before5pm: [...lightDay.before5pm, ...lightDay.before6pm],
            before9pm: [...lightDay.before9pm, ...lightDay.before12am]
          },
          startWithHeavy
        }
        await storage.savePlanConfig(planConfig)
        console.log('Plan config saved')

        return 'success'
      })()

      const result = await Promise.race([savePromise, timeoutPromise])

      if (result === 'timeout') {
        console.warn('Save operation timed out, but likely succeeded')
      }

      console.log('All schedules saved, setting step to done')
      setIsSaving(false)
      setStep('done')
      setTimeout(() => onComplete(), 1500)
    } catch (error) {
      console.error('Error saving schedules:', error)
      alert('Failed to save schedules: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setIsSaving(false)
    }
  }

  // Toggle activity selection
  const toggleActivitySelection = (activityId: string) => {
    setSelections(prev => {
      const existing = prev.find(s => s.activityId === activityId)
      if (existing) {
        // Remove selection
        return prev.filter(s => s.activityId !== activityId)
      } else {
        // Add with default frequency based on activity type
        const activity = getActivity(activityId)
        let defaultFrequency: PlanFrequency = 'everyday'

        // Use dayType from Notion if available
        if (activity?.dayType) {
          if (activity.dayType === 'heavy') {
            defaultFrequency = 'heavy'
          } else if (activity.dayType === 'light') {
            defaultFrequency = 'light'
          } else if (activity.dayType === 'both') {
            defaultFrequency = 'everyday'
          }
        } else if (activity?.weekdayOnly) {
          // Fallback for weekday-only activities
          defaultFrequency = 'weekdays'
        }

        return [...prev, { activityId, frequency: defaultFrequency }]
      }
    })
  }

  // Update frequency for an activity
  const updateFrequency = (activityId: string, frequency: PlanFrequency) => {
    if (frequency === 'custom') {
      // Open the custom day picker modal
      setCustomDayPickerActivity(activityId)
      // Still update to 'custom' frequency, but customDays will be set via the picker
      setSelections(prev =>
        prev.map(s => s.activityId === activityId ? { ...s, frequency, customDays: s.customDays || [] } : s)
      )
    } else {
      setSelections(prev =>
        prev.map(s => s.activityId === activityId ? { ...s, frequency, customDays: undefined } : s)
      )
    }
  }

  // Update custom days for an activity
  const updateCustomDays = (activityId: string, days: string[]) => {
    setSelections(prev =>
      prev.map(s => s.activityId === activityId ? { ...s, customDays: days } : s)
    )
  }

  // Get next 7 days starting from tomorrow
  const getNext7Days = useMemo(() => {
    const days: Date[] = []
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    for (let i = 0; i < 7; i++) {
      const day = new Date(tomorrow)
      day.setDate(tomorrow.getDate() + i)
      days.push(day)
    }
    return days
  }, [])

  // Update variant for an activity
  const updateVariant = (activityId: string, variantId: string | undefined) => {
    setSelections(prev =>
      prev.map(s => s.activityId === activityId ? { ...s, variantId } : s)
    )
  }

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  // Handle coach suggestion acceptance
  const handleCoachSuggestion = (activityId: string) => {
    // Check if already selected
    const existing = selections.find(s => s.activityId === activityId)
    if (!existing) {
      // Add with everyday frequency for mind-body activities
      setSelections(prev => [...prev, { activityId, frequency: 'everyday' as PlanFrequency }])
      // Expand mind_body category to show the selection
      if (!expandedCategories.includes('mind_body')) {
        setExpandedCategories(prev => [...prev, 'mind_body'])
      }
    }
  }

  // Apply saved plan configuration
  const applySavedConfig = useCallback(() => {
    if (!savedConfig) return

    // Restore selections with frequencies
    const restoredSelections: ActivitySelection[] = savedConfig.selectedActivities
      .filter(actId => getActivity(actId)) // Only include activities that still exist
      .map(activityId => ({
        activityId,
        frequency: savedConfig.frequencies[activityId] || 'everyday'
      }))

    setSelections(restoredSelections)
    setStartWithHeavy(savedConfig.startWithHeavy)

    // Restore day templates
    const emptyTemplate: DayTemplate = {
      before6am: [],
      before9am: [],
      before12pm: [],
      before3pm: [],
      before5pm: [],
      before6pm: [],
      before9pm: [],
      before12am: [],
      beforeNoon: [],
      before230pm: []
    }

    setHeavyDay({
      ...emptyTemplate,
      before6am: savedConfig.heavyDaySchedule.before6am || [],
      before9am: savedConfig.heavyDaySchedule.before9am || [],
      beforeNoon: savedConfig.heavyDaySchedule.beforeNoon || [],
      before230pm: savedConfig.heavyDaySchedule.before230pm || [],
      before5pm: savedConfig.heavyDaySchedule.before5pm || [],
      before9pm: savedConfig.heavyDaySchedule.before9pm || []
    })

    setLightDay({
      ...emptyTemplate,
      before6am: savedConfig.lightDaySchedule.before6am || [],
      before9am: savedConfig.lightDaySchedule.before9am || [],
      beforeNoon: savedConfig.lightDaySchedule.beforeNoon || [],
      before230pm: savedConfig.lightDaySchedule.before230pm || [],
      before5pm: savedConfig.lightDaySchedule.before5pm || [],
      before9pm: savedConfig.lightDaySchedule.before9pm || []
    })

    // Expand all categories that have selected activities
    const categoriesWithSelections = new Set(
      restoredSelections.map(s => getActivity(s.activityId)?.category).filter(Boolean)
    )
    setExpandedCategories(Array.from(categoriesWithSelections) as string[])
  }, [savedConfig, getActivity])

  // Toggle variant expansion
  const toggleVariantExpansion = (activityId: string) => {
    setExpandedVariants(prev =>
      prev.includes(activityId) ? prev.filter(a => a !== activityId) : [...prev, activityId]
    )
  }

  // Determine drop target (block and index) based on Y position
  const getDropTargetFromY = useCallback((y: number, template: DayTemplate): { block: TimeBlock; index: number } | null => {
    // Build a sorted list of all blocks with their bounds
    const blockBounds: { block: TimeBlock; top: number; bottom: number }[] = []

    for (const block of TIME_BLOCKS) {
      const blockEl = blockRefs.current[block]
      if (blockEl) {
        const rect = blockEl.getBoundingClientRect()
        blockBounds.push({ block, top: rect.top, bottom: rect.bottom })
      }
    }

    // If no blocks found, default to before9am
    if (blockBounds.length === 0) {
      return { block: 'before9am', index: 0 }
    }

    // Sort by top position (should already be in order, but be safe)
    blockBounds.sort((a, b) => a.top - b.top)

    // Check if we're ABOVE the very first block (before9am typically)
    const firstBlock = blockBounds[0]
    if (y < firstBlock.top) {
      // User is dragging above all blocks - target the first block at index 0
      return { block: firstBlock.block, index: 0 }
    }

    // Check if we're BELOW the last block
    const lastBlock = blockBounds[blockBounds.length - 1]
    if (y > lastBlock.bottom) {
      const activities = template[lastBlock.block]
      return { block: lastBlock.block, index: activities.length }
    }

    // Find which block we're in
    let targetBlock: TimeBlock | null = null

    for (const { block, top, bottom } of blockBounds) {
      if (y >= top && y <= bottom) {
        targetBlock = block
        break
      }
    }

    // If between blocks, find the closest one
    if (!targetBlock) {
      let minDistance = Infinity
      for (const { block, top, bottom } of blockBounds) {
        const distToTop = Math.abs(y - top)
        const distToBottom = Math.abs(y - bottom)
        const dist = Math.min(distToTop, distToBottom)

        if (dist < minDistance) {
          minDistance = dist
          targetBlock = block
        }
      }
    }

    // Fallback
    if (!targetBlock) {
      return { block: 'before9am', index: 0 }
    }

    const activities = template[targetBlock]

    // Find the insertion point within the block
    for (let i = 0; i < activities.length; i++) {
      const itemEl = itemRefs.current.get(`${targetBlock}-${i}`)
      if (!itemEl) continue

      const itemRect = itemEl.getBoundingClientRect()
      const itemMidY = itemRect.top + itemRect.height / 2

      if (y < itemMidY) {
        return { block: targetBlock, index: i }
      }
    }

    return { block: targetBlock, index: activities.length }
  }, [])

  // Pointer event handlers for drag
  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    activityId: string,
    sourceBlock: TimeBlock,
    sourceIndex: number
  ) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setDragState({
      activityId,
      sourceBlock,
      sourceIndex,
      currentY: e.clientY,
      startY: e.clientY,
      isDragging: false
    })
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent, isHeavy: boolean) => {
    if (!dragState) return

    const template = isHeavy ? heavyDay : lightDay
    const deltaY = Math.abs(e.clientY - dragState.startY)
    const newDragState = {
      ...dragState,
      currentY: e.clientY,
      isDragging: dragState.isDragging || deltaY > 10
    }
    setDragState(newDragState)

    if (newDragState.isDragging) {
      const target = getDropTargetFromY(e.clientY, template)
      setDropTarget(target)
    }
  }, [dragState, getDropTargetFromY, heavyDay, lightDay])

  const handlePointerUp = useCallback((e: React.PointerEvent, isHeavy: boolean) => {
    if (!dragState) return
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Pointer capture may have already been released
    }

    if (dragState.isDragging && dropTarget) {
      const setTemplate = isHeavy ? setHeavyDay : setLightDay
      const { block: targetBlock, index: targetIndex } = dropTarget
      const { sourceBlock, sourceIndex, activityId } = dragState

      if (targetBlock === sourceBlock) {
        if (targetIndex !== sourceIndex && targetIndex !== sourceIndex + 1) {
          setTemplate(prev => {
            const activities = [...prev[sourceBlock]]
            const [item] = activities.splice(sourceIndex, 1)
            const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
            activities.splice(insertAt, 0, item)
            return { ...prev, [sourceBlock]: activities }
          })
        }
      } else {
        setTemplate(prev => {
          const sourceActivities = prev[sourceBlock].filter(id => id !== activityId)
          const targetActivities = [...prev[targetBlock]]
          targetActivities.splice(targetIndex, 0, activityId)
          return {
            ...prev,
            [sourceBlock]: sourceActivities,
            [targetBlock]: targetActivities
          }
        })
      }
    }

    setDragState(null)
    setDropTarget(null)
  }, [dragState, dropTarget])

  // Preview drag handlers
  const getPreviewDropTargetFromY = useCallback((y: number, dateStr: string): { block: TimeBlock; index: number } | null => {
    const schedule = generatedSchedules[dateStr]
    if (!schedule) return null

    // Build a sorted list of all blocks with their bounds
    const blockBounds: { block: TimeBlock; top: number; bottom: number }[] = []

    for (const block of TIME_BLOCKS) {
      const blockEl = previewBlockRefs.current[block]
      if (blockEl) {
        const rect = blockEl.getBoundingClientRect()
        blockBounds.push({ block, top: rect.top, bottom: rect.bottom })
      }
    }

    // If no blocks found, default to before9am
    if (blockBounds.length === 0) {
      return { block: 'before9am', index: 0 }
    }

    // Sort by top position
    blockBounds.sort((a, b) => a.top - b.top)

    // Check if we're ABOVE the very first block
    const firstBlock = blockBounds[0]
    if (y < firstBlock.top) {
      return { block: firstBlock.block, index: 0 }
    }

    // Check if we're BELOW the last block
    const lastBlock = blockBounds[blockBounds.length - 1]
    if (y > lastBlock.bottom) {
      const activities = schedule.activities[lastBlock.block]
      return { block: lastBlock.block, index: activities.length }
    }

    // Find which block we're in
    let targetBlock: TimeBlock | null = null

    for (const { block, top, bottom } of blockBounds) {
      if (y >= top && y <= bottom) {
        targetBlock = block
        break
      }
    }

    // If between blocks, find the closest one
    if (!targetBlock) {
      let minDistance = Infinity
      for (const { block, top, bottom } of blockBounds) {
        const dist = Math.min(Math.abs(y - top), Math.abs(y - bottom))
        if (dist < minDistance) {
          minDistance = dist
          targetBlock = block
        }
      }
    }

    if (!targetBlock) {
      return { block: 'before9am', index: 0 }
    }

    const activities = schedule.activities[targetBlock]

    for (let i = 0; i < activities.length; i++) {
      const itemEl = previewItemRefs.current.get(`${targetBlock}-${i}`)
      if (!itemEl) continue

      const itemRect = itemEl.getBoundingClientRect()
      const itemMidY = itemRect.top + itemRect.height / 2

      if (y < itemMidY) {
        return { block: targetBlock, index: i }
      }
    }

    return { block: targetBlock, index: activities.length }
  }, [generatedSchedules])

  const handlePreviewPointerDown = useCallback((
    e: React.PointerEvent,
    activityId: string,
    sourceBlock: TimeBlock,
    sourceIndex: number,
    dateStr: string
  ) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setPreviewDragState({
      activityId,
      sourceBlock,
      sourceIndex,
      dateStr,
      currentY: e.clientY,
      startY: e.clientY,
      isDragging: false
    })
  }, [])

  const handlePreviewPointerMove = useCallback((e: React.PointerEvent) => {
    if (!previewDragState) return

    const deltaY = Math.abs(e.clientY - previewDragState.startY)
    const newDragState = {
      ...previewDragState,
      currentY: e.clientY,
      isDragging: previewDragState.isDragging || deltaY > 10
    }
    setPreviewDragState(newDragState)

    if (newDragState.isDragging) {
      const target = getPreviewDropTargetFromY(e.clientY, previewDragState.dateStr)
      setPreviewDropTarget(target)
    }
  }, [previewDragState, getPreviewDropTargetFromY])

  const handlePreviewPointerUp = useCallback((e: React.PointerEvent) => {
    if (!previewDragState) return
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Pointer capture may have already been released
    }

    if (previewDragState.isDragging && previewDropTarget) {
      const { block: targetBlock, index: targetIndex } = previewDropTarget
      const { sourceBlock, sourceIndex, activityId, dateStr } = previewDragState

      if (targetBlock === sourceBlock) {
        if (targetIndex !== sourceIndex && targetIndex !== sourceIndex + 1) {
          setGeneratedSchedules(prev => {
            const activities = [...prev[dateStr].activities[sourceBlock]]
            const [item] = activities.splice(sourceIndex, 1)
            const insertAt = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
            activities.splice(insertAt, 0, item)
            return {
              ...prev,
              [dateStr]: {
                ...prev[dateStr],
                activities: { ...prev[dateStr].activities, [sourceBlock]: activities }
              }
            }
          })
        }
      } else {
        setGeneratedSchedules(prev => {
          const sourceActivities = prev[dateStr].activities[sourceBlock].filter(id => id !== activityId)
          const targetActivities = [...prev[dateStr].activities[targetBlock]]
          targetActivities.splice(targetIndex, 0, activityId)
          return {
            ...prev,
            [dateStr]: {
              ...prev[dateStr],
              activities: {
                ...prev[dateStr].activities,
                [sourceBlock]: sourceActivities,
                [targetBlock]: targetActivities
              }
            }
          }
        })
      }
    }

    setPreviewDragState(null)
    setPreviewDropTarget(null)
  }, [previewDragState, previewDropTarget])

  // Remove activity from template
  const removeFromTemplate = (activityId: string, block: TimeBlock, isHeavy: boolean) => {
    const setTemplate = isHeavy ? setHeavyDay : setLightDay
    setTemplate(prev => ({
      ...prev,
      [block]: prev[block].filter(id => id !== activityId)
    }))
  }

  // Add activity to template
  const [showAddModal, setShowAddModal] = useState<{block: TimeBlock, isHeavy: boolean} | null>(null)

  const addToTemplate = (activityId: string) => {
    if (!showAddModal) return
    const { block, isHeavy } = showAddModal
    const setTemplate = isHeavy ? setHeavyDay : setLightDay
    setTemplate(prev => ({
      ...prev,
      [block]: prev[block].includes(activityId) ? prev[block] : [...prev[block], activityId]
    }))
    setShowAddModal(null)
  }

  // Remove from preview
  const handleRemoveFromPreview = (dateStr: string, activityId: string, block: TimeBlock) => {
    setGeneratedSchedules(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        activities: {
          ...prev[dateStr].activities,
          [block]: prev[dateStr].activities[block].filter(id => id !== activityId)
        }
      }
    }))
  }

  // Swap in preview
  const handleSwapInPreview = (dateStr: string, oldId: string, newId: string, block: TimeBlock) => {
    setGeneratedSchedules(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        activities: {
          ...prev[dateStr].activities,
          [block]: prev[dateStr].activities[block].map(id => id === oldId ? newId : id)
        }
      }
    }))
    setSwappingActivity(null)
  }

  // Add to preview
  const handleAddToPreview = (activityId: string) => {
    if (!addToPreviewModal) return
    const { dateStr, block } = addToPreviewModal
    setGeneratedSchedules(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        activities: {
          ...prev[dateStr].activities,
          [block]: prev[dateStr].activities[block].includes(activityId)
            ? prev[dateStr].activities[block]
            : [...prev[dateStr].activities[block], activityId]
        }
      }
    }))
    setAddToPreviewModal(null)
  }

  // Render draggable activity item for template editing
  const renderDraggableActivityItem = (
    activityId: string,
    block: TimeBlock,
    index: number,
    isHeavy: boolean,
    onRemove: () => void
  ) => {
    const activity = getActivity(activityId)
    if (!activity) return null
    const isDragging = dragState?.activityId === activityId && dragState?.isDragging

    const showDropBefore = dropTarget &&
      dropTarget.block === block &&
      dropTarget.index === index &&
      dragState?.isDragging &&
      !(dragState?.sourceBlock === block && (dragState?.sourceIndex === index || dragState?.sourceIndex === index - 1))

    return (
      <div key={`${activityId}-${index}`}>
        {showDropBefore && (
          <div className="h-1 bg-primary rounded-full mx-2 my-1 animate-pulse" />
        )}
        <div
          ref={(el) => {
            if (el) {
              itemRefs.current.set(`${block}-${index}`, el)
            }
          }}
          className={cn(
            "rounded-lg border bg-card overflow-hidden transition-all select-none",
            isDragging && "opacity-50 scale-95"
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => handlePointerDown(e, activityId, block, index)}
        >
          {/* Spectrum bar at top */}
          {activity.spectrum && (
            <SpectrumBar spectrum={activity.spectrum} size="sm" />
          )}
          <div className="flex items-center gap-3 py-2 px-2">
            <div className="text-muted-foreground/50 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium flex-1">{activity.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render activity item for preview (with drag + swap option)
  const renderPreviewActivityItem = (
    activityId: string,
    block: TimeBlock,
    index: number,
    dateStr: string
  ) => {
    const activity = getActivity(activityId)
    if (!activity) return null
    const isDragging = previewDragState?.activityId === activityId && previewDragState?.isDragging

    const showDropBefore = previewDropTarget &&
      previewDropTarget.block === block &&
      previewDropTarget.index === index &&
      previewDragState?.isDragging &&
      !(previewDragState?.sourceBlock === block && (previewDragState?.sourceIndex === index || previewDragState?.sourceIndex === index - 1))

    return (
      <div key={`${activityId}-${index}`}>
        {showDropBefore && (
          <div className="h-1 bg-primary rounded-full mx-2 my-1 animate-pulse" />
        )}
        <div
          ref={(el) => {
            if (el) {
              previewItemRefs.current.set(`${block}-${index}`, el)
            }
          }}
          className={cn(
            "rounded-lg border bg-card overflow-hidden transition-all select-none",
            isDragging && "opacity-50 scale-95"
          )}
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => handlePreviewPointerDown(e, activityId, block, index, dateStr)}
        >
          {/* Spectrum bar at top */}
          {activity.spectrum && (
            <SpectrumBar spectrum={activity.spectrum} size="sm" />
          )}
          <div className="flex items-center gap-3 py-2 px-2">
            <div className="text-muted-foreground/50 cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium flex-1">{activity.name}</span>
            <button
              onClick={() => setSwappingActivity({ dateStr, activityId, timeBlock: block })}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleRemoveFromPreview(dateStr, activityId, block)}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render time block section - activities appear ABOVE their deadline divider
  const renderTimeBlockSection = (block: TimeBlock, activities: string[], isHeavy: boolean) => {
    const deadlineLabel = TIME_BLOCK_DEADLINE_LABELS[block]
    const isBlockDropTarget = dropTarget?.block === block && dragState?.sourceBlock !== block

    const showDropAtEnd = dropTarget &&
      dropTarget.block === block &&
      dropTarget.index === activities.length &&
      dragState?.isDragging &&
      !(dragState?.sourceBlock === block && dragState?.sourceIndex === activities.length - 1)

    return (
      <div
        key={block}
        ref={(el) => { blockRefs.current[block] = el }}
        className={cn(
          "transition-colors",
          isBlockDropTarget && "bg-primary/10 rounded-lg"
        )}
      >
        {/* Activities for this time block */}
        <div className="space-y-1">
          {activities.map((actId, idx) =>
            renderDraggableActivityItem(actId, block, idx, isHeavy, () => removeFromTemplate(actId, block, isHeavy))
          )}
          {showDropAtEnd && (
            <div className="h-1 bg-primary rounded-full mx-2 my-1 animate-pulse" />
          )}
        </div>

        {/* Time deadline divider - shows AFTER activities as the deadline */}
        <div className="flex items-center gap-3 py-2">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs font-medium text-muted-foreground px-2">{deadlineLabel}</span>
          <div className="flex-1 border-t border-border" />
          <button
            onClick={() => setShowAddModal({ block, isHeavy })}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // ============ STEP 1: Activity Selection ============
  if (step === 'select_activities') {
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Step 1 of 5</span>
            {activitySource === 'cached' && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 text-xs">Cached</span>
            )}
            {activitySource === 'notion' && (
              <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 text-xs">Synced</span>
            )}
            <button
              onClick={syncFromNotion}
              disabled={isSyncing}
              className="px-2 py-0.5 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground text-xs disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Notion'}
            </button>
          </div>
          <h2 className="text-xl font-semibold">What would you like to focus on?</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Select activities and choose when they should appear
          </p>
        </div>

        {/* Health Coach suggestion button */}
        <button
          onClick={() => setShowHealthCoach(true)}
          className="w-full p-4 rounded-xl border bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800 hover:shadow-md transition-all text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-sm">Ask your Health Coach</p>
              <p className="text-xs text-muted-foreground">Get personalized mind-body activity suggestions</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
          </div>
        </button>

        {/* Use Previous Plan button - only show if config exists and nothing selected yet */}
        {savedConfig && !loadingSavedConfig && selections.length === 0 && (
          <button
            onClick={applySavedConfig}
            className="w-full p-4 rounded-xl border bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-sm">Use Previous Plan</p>
                <p className="text-xs text-muted-foreground">
                  {savedConfig.selectedActivities.length} activities from {new Date(savedConfig.savedAt).toLocaleDateString()}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
            </div>
          </button>
        )}

        {activitiesLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        ) : (
        <div className="space-y-2">
          {CATEGORY_ORDER.map(categoryId => {
            const category = CATEGORIES[categoryId]
            const activities = activitiesByCategory[categoryId]
            const isExpanded = expandedCategories.includes(categoryId)
            const selectedCount = selections.filter(s =>
              activities.some(a => a.id === s.activityId)
            ).length

            if (activities.length === 0) return null

            return (
              <div key={categoryId} className="rounded-xl border bg-card overflow-hidden">
                <button
                  onClick={() => toggleCategory(categoryId)}
                  className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{category.name}</span>
                    {selectedCount > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {selectedCount} selected
                      </span>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div className="border-t px-3 py-2 divide-y divide-border/50">
                    {activities.map(activity => {
                      const selection = selections.find(s => s.activityId === activity.id)
                      const isSelected = !!selection
                      const hasVariants = activity.isGeneric && activity.variants && activity.variants.length > 0
                      const isVariantExpanded = expandedVariants.includes(activity.id)
                      const variants = hasVariants ? getVariantsForActivity(activity.id) : []

                      return (
                        <div key={activity.id} className="py-1 first:pt-0 last:pb-0">
                          <div className={cn(
                            "rounded-lg overflow-hidden transition-all",
                            isSelected && "bg-primary/5"
                          )}>
                            {/* Spectrum bar at top */}
                            {activity.spectrum && (
                              <SpectrumBar spectrum={activity.spectrum} size="sm" />
                            )}
                            <div className="flex items-center gap-3 p-2">
                              {/* Checkbox */}
                              <button
                                onClick={() => toggleActivitySelection(activity.id)}
                                className={cn(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-muted-foreground/30"
                                )}
                              >
                                {isSelected && <Check className="h-3 w-3" />}
                              </button>

                            {/* Activity info */}
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => toggleActivitySelection(activity.id)}
                            >
                              <span className="flex items-center gap-1.5">
                                {activity.favorite && (
                                  <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                                )}
                                <span className="font-medium text-sm">{activity.name}</span>
                              </span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{activity.duration} min</span>
                                {activity.video && (
                                  <Video className="h-3 w-3" title="Has video" />
                                )}
                                {!activity.video && activity.link && (
                                  <ExternalLink className="h-3 w-3" title="External link" />
                                )}
                                {hasMultipleSteps(activity.instructions || '') && (
                                  <Volume2 className="h-3 w-3" title="Audio guide available" />
                                )}
                              </div>
                            </div>

                            {/* Info button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setViewingActivity(activity)
                              }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                              title="View activity details"
                            >
                              <Info className="h-4 w-4" />
                            </button>

                            {/* Frequency dropdown (only when selected) */}
                            {isSelected && (
                              <div className="flex items-center gap-1">
                                <select
                                  value={selection.frequency}
                                  onChange={(e) => updateFrequency(activity.id, e.target.value as PlanFrequency)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs px-2 py-1 rounded border border-border bg-background"
                                >
                                  {FREQUENCY_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                                {/* Edit button for custom days */}
                                {selection.frequency === 'custom' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setCustomDayPickerActivity(activity.id)
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                                  >
                                    {selection.customDays?.length || 0}d
                                  </button>
                                )}
                              </div>
                            )}

                              {/* Variant toggle */}
                              {hasVariants && isSelected && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleVariantExpansion(activity.id)
                                  }}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                                >
                                  <ChevronDown className={cn("h-4 w-4 transition-transform", isVariantExpanded && "rotate-180")} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Variant selection */}
                          {hasVariants && isSelected && isVariantExpanded && (
                            <div className="ml-8 pl-3 border-l-2 border-muted space-y-1">
                              {/* Any option */}
                              <label className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`variant-${activity.id}`}
                                  checked={!selection.variantId}
                                  onChange={() => updateVariant(activity.id, undefined)}
                                  className="w-4 h-4"
                                />
                                <span className="text-sm">Any location</span>
                              </label>
                              {/* Specific variants */}
                              {variants.map(variant => (
                                <label key={variant.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`variant-${activity.id}`}
                                    checked={selection.variantId === variant.id}
                                    onChange={() => updateVariant(activity.id, variant.id)}
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm">{variant.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={onBack}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={() => {
              generateTemplatesFromSelections()
              setStep('tomorrow_type')
            }}
            disabled={selections.length === 0}
          >
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Activity Detail Modal */}
        {viewingActivity && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => { setViewingActivity(null); setShowActivityDetails(false) }}
          >
            <div
              className="w-full max-w-md max-h-[75dvh] overflow-hidden rounded-xl bg-card animate-in zoom-in-95 duration-200 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Spectrum bar at top */}
              {viewingActivity.spectrum && (
                <SpectrumBar spectrum={viewingActivity.spectrum} size="md" />
              )}

              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card p-4">
                <h2 className="text-lg font-semibold">{viewingActivity.name}</h2>
                <button
                  onClick={() => { setViewingActivity(null); setShowActivityDetails(false) }}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {viewingActivity.duration} min
                  </span>
                  <span className="text-xs">{CATEGORIES[viewingActivity.category].name}</span>
                </div>

                {/* Description with expandable details */}
                <div className="rounded-lg bg-muted p-3 text-foreground text-sm">
                  <p className={showActivityDetails ? '' : 'line-clamp-2'}>{viewingActivity.description}</p>

                  {/* Expandable instructions */}
                  {showActivityDetails && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      {/* Video link */}
                      {viewingActivity.video && (
                        <a
                          href={viewingActivity.video}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary text-xs font-medium hover:underline mb-3"
                        >
                          <Play className="h-3 w-3" />
                          Watch Video
                        </a>
                      )}

                      {/* Link */}
                      {viewingActivity.link && !viewingActivity.video && (
                        <a
                          href={viewingActivity.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary text-xs font-medium hover:underline mb-3"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open Resource
                        </a>
                      )}

                      {/* Instructions */}
                      {viewingActivity.instructions && (
                        <div
                          className="prose prose-sm max-w-none text-muted-foreground [&_h4]:text-xs [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:text-muted-foreground [&_h4]:font-semibold [&_h4]:mb-2 [&_ol]:pl-4 [&_ol]:text-xs [&_li]:mb-1.5 [&_p]:mt-2 [&_p]:text-xs"
                          dangerouslySetInnerHTML={{ __html: viewingActivity.instructions }}
                        />
                      )}
                    </div>
                  )}

                  {/* Show more/less toggle */}
                  {(viewingActivity.instructions || viewingActivity.link || viewingActivity.video) && (
                    <button
                      onClick={() => setShowActivityDetails(!showActivityDetails)}
                      className="flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline"
                    >
                      {showActivityDetails ? (
                        <>
                          <ChevronUp className="h-3 w-3" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3" />
                          Show more
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Action button - fixed at bottom */}
              <div className="p-4 border-t bg-card shrink-0">
                <Button
                  className="w-full"
                  onClick={() => {
                    // Toggle selection when closing detail view
                    const isCurrentlySelected = selections.some(s => s.activityId === viewingActivity.id)
                    if (!isCurrentlySelected) {
                      toggleActivitySelection(viewingActivity.id)
                    }
                    setViewingActivity(null)
                    setShowActivityDetails(false)
                  }}
                >
                  {selections.some(s => s.activityId === viewingActivity.id) ? 'Done' : 'Select Activity'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Health Coach Modal */}
        {showHealthCoach && (
          <HealthCoachModal
            onClose={() => setShowHealthCoach(false)}
            onAcceptSuggestion={handleCoachSuggestion}
            onAddToToday={(activityIds) => {
              // In planning context, "Add to Today" just adds to selections
              activityIds.forEach(id => handleCoachSuggestion(id))
              setShowHealthCoach(false)
            }}
            onFocusForWeek={(activityIds) => {
              // "Focus for Week" adds to selections (we're already in planning)
              activityIds.forEach(id => handleCoachSuggestion(id))
              setShowHealthCoach(false)
            }}
          />
        )}

        {/* Custom Day Picker Modal */}
        {customDayPickerActivity && (() => {
          const selection = selections.find(s => s.activityId === customDayPickerActivity)
          const activity = getActivity(customDayPickerActivity)
          const selectedDays = selection?.customDays || []

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setCustomDayPickerActivity(null)}
            >
              <div
                className="w-full max-w-sm rounded-2xl bg-card animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b p-4">
                  <div>
                    <h2 className="text-lg font-semibold">Select Days</h2>
                    <p className="text-sm text-muted-foreground">{activity?.name}</p>
                  </div>
                  <button
                    onClick={() => setCustomDayPickerActivity(null)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Day picker grid */}
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">Tap the days you want to do this activity:</p>
                  <div className="grid grid-cols-7 gap-1.5">
                    {getNext7Days.map(day => {
                      const dateStr = formatDateISO(day)
                      const isSelected = selectedDays.includes(dateStr)
                      const dayName = getShortDayName(day)
                      const dayNum = getDayNumber(day)
                      const dayWeather = getWeatherForDate(dateStr)

                      return (
                        <button
                          key={dateStr}
                          onClick={() => {
                            const newDays = isSelected
                              ? selectedDays.filter(d => d !== dateStr)
                              : [...selectedDays, dateStr]
                            updateCustomDays(customDayPickerActivity, newDays)
                          }}
                          className={cn(
                            "flex flex-col items-center p-2 rounded-lg transition-all",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-muted/80"
                          )}
                        >
                          <span className="text-xs font-medium">{dayName}</span>
                          <span className="text-lg font-semibold">{dayNum}</span>
                          {dayWeather && (
                            <span className="text-sm mt-0.5">
                              {getWeatherEmoji(dayWeather.weather.main, dayWeather.weather.id)}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t p-4">
                  <Button
                    className="w-full"
                    onClick={() => setCustomDayPickerActivity(null)}
                    disabled={selectedDays.length === 0}
                  >
                    Done ({selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected)
                  </Button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    )
  }

  // ============ STEP 2: Tomorrow Type ============
  if (step === 'tomorrow_type') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Step 2 of 5</span>
          </div>
          <h2 className="text-xl font-semibold">What type of day is tomorrow?</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Your week will alternate between heavy and light days
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setStartWithHeavy(true)}
            className={cn(
              'w-full p-4 rounded-xl border text-left transition-all',
              startWithHeavy
                ? 'border-orange-500 bg-orange-500/5 ring-2 ring-orange-500'
                : 'border-border bg-card hover:border-orange-500/50'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                startWithHeavy ? 'bg-orange-500 text-white' : 'bg-orange-500/20 text-orange-600'
              )}>
                <Zap className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Heavy Day</span>
                  {startWithHeavy && <Check className="h-4 w-4 text-orange-500" />}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Intense workouts and challenging activities
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={() => setStartWithHeavy(false)}
            className={cn(
              'w-full p-4 rounded-xl border text-left transition-all',
              !startWithHeavy
                ? 'border-green-500 bg-green-500/5 ring-2 ring-green-500'
                : 'border-border bg-card hover:border-green-500/50'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                !startWithHeavy ? 'bg-green-500 text-white' : 'bg-green-500/20 text-green-600'
              )}>
                <Leaf className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Light Day</span>
                  {!startWithHeavy && <Check className="h-4 w-4 text-green-500" />}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Recovery, learning, and lighter activities
                </p>
              </div>
            </div>
          </button>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep('select_activities')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button className="flex-1" onClick={() => setStep('design_tomorrow')}>
            Design Tomorrow <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // ============ STEP 3: Design Tomorrow ============
  if (step === 'design_tomorrow') {
    const isHeavy = startWithHeavy
    const template = isHeavy ? heavyDay : lightDay
    const Icon = isHeavy ? Zap : Leaf
    const color = isHeavy ? 'orange' : 'green'

    return (
      <div className="space-y-4">
        {/* Prominent day type banner with animation */}
        <div className={cn(
          "rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300",
          isHeavy
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
            : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
        )}>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-in zoom-in duration-500">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-sm opacity-90">Step 3 of 5 · Tomorrow</div>
            <h2 className="text-xl font-bold">{isHeavy ? '⚡ Heavy Day' : '🌿 Light Day'}</h2>
          </div>
        </div>

        <div
          className="bg-card rounded-xl border p-4"
          onPointerMove={(e) => handlePointerMove(e, isHeavy)}
          onPointerUp={(e) => handlePointerUp(e, isHeavy)}
          onPointerLeave={(e) => handlePointerUp(e, isHeavy)}
        >
          {renderTimeBlockSection('before6am', template.before6am, isHeavy)}
          {renderTimeBlockSection('before9am', template.before9am, isHeavy)}
          {renderTimeBlockSection('beforeNoon', template.beforeNoon, isHeavy)}
          {renderTimeBlockSection('before230pm', template.before230pm, isHeavy)}
          {renderTimeBlockSection('before5pm', template.before5pm, isHeavy)}
          {renderTimeBlockSection('before9pm', template.before9pm, isHeavy)}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep('tomorrow_type')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button className="flex-1" onClick={() => setStep('design_alternate')}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {showAddModal && (
          <AddActivityModal
            onClose={() => setShowAddModal(null)}
            onAdd={addToTemplate}
            currentActivities={template[showAddModal.block]}
          />
        )}
      </div>
    )
  }

  // ============ STEP 4: Design Alternate ============
  if (step === 'design_alternate') {
    const isHeavy = !startWithHeavy  // Opposite of tomorrow
    const template = isHeavy ? heavyDay : lightDay
    const Icon = isHeavy ? Zap : Leaf
    const color = isHeavy ? 'orange' : 'green'

    return (
      <div className="space-y-4">
        {/* Prominent day type banner with animation */}
        <div className={cn(
          "rounded-xl p-4 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300",
          isHeavy
            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
            : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
        )}>
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center animate-in zoom-in duration-500">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-sm opacity-90">Step 4 of 5 · Alternate Days</div>
            <h2 className="text-xl font-bold">{isHeavy ? '⚡ Heavy Day' : '🌿 Light Day'}</h2>
          </div>
        </div>

        <div
          className="bg-card rounded-xl border p-4"
          onPointerMove={(e) => handlePointerMove(e, isHeavy)}
          onPointerUp={(e) => handlePointerUp(e, isHeavy)}
          onPointerLeave={(e) => handlePointerUp(e, isHeavy)}
        >
          {renderTimeBlockSection('before6am', template.before6am, isHeavy)}
          {renderTimeBlockSection('before9am', template.before9am, isHeavy)}
          {renderTimeBlockSection('beforeNoon', template.beforeNoon, isHeavy)}
          {renderTimeBlockSection('before230pm', template.before230pm, isHeavy)}
          {renderTimeBlockSection('before5pm', template.before5pm, isHeavy)}
          {renderTimeBlockSection('before9pm', template.before9pm, isHeavy)}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep('design_tomorrow')}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button className="flex-1" onClick={generateSchedules}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {showAddModal && (
          <AddActivityModal
            onClose={() => setShowAddModal(null)}
            onAdd={addToTemplate}
            currentActivities={template[showAddModal.block]}
          />
        )}
      </div>
    )
  }

  // ============ STEP 5: Preview ============
  if (step === 'preview') {
    const getSwapOptions = () => {
      if (!swappingActivity) return []
      const currentActivity = getActivity(swappingActivity.activityId)
      if (!currentActivity) return []
      return Object.values(allActivities).filter(a =>
        a.category === currentActivity.category && a.id !== swappingActivity.activityId
      )
    }

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Preview Your Week</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Drag to reorder. Tap + to add activities.
          </p>
        </div>

        <div className="space-y-2">
          {weekDates.map((date, dateIndex) => {
            const dateStr = formatDateISO(date)
            const schedule = generatedSchedules[dateStr]
            if (!schedule) return null

            const allActivitiesForDay = Object.values(schedule.activities).flat()
            const isExpanded = expandedDay === dateStr
            const isHeavyDay = startWithHeavy ? (dateIndex % 2 === 0) : (dateIndex % 2 === 1)
            const dayWeather = getWeatherForDate(dateStr)
            const badWeather = hasBadWeather(dateStr)

            // Check if any outdoor activities are scheduled on a bad weather day
            const hasOutdoorActivities = allActivitiesForDay.some(actId => {
              const act = getActivity(actId)
              return act?.outdoor || act?.weatherDependent
            })

            return (
              <div
                key={dateStr}
                className={cn(
                  "rounded-xl border bg-card overflow-hidden transition-all",
                  isExpanded && "ring-2 ring-primary",
                  badWeather && hasOutdoorActivities && "border-amber-500/50"
                )}
              >
                <button
                  onClick={() => setExpandedDay(isExpanded ? undefined : dateStr)}
                  className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-primary font-medium leading-none">{getShortDayName(date)}</span>
                      <span className="text-sm font-bold text-primary leading-none">{getDayNumber(date)}</span>
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{allActivitiesForDay.length} activities</span>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          isHeavyDay ? "bg-orange-500/20 text-orange-600" : "bg-green-500/20 text-green-600"
                        )}>
                          {isHeavyDay ? 'Heavy' : 'Light'}
                        </span>
                        {dayWeather && (
                          <span className="text-xs flex items-center gap-1 text-muted-foreground">
                            {getWeatherEmoji(dayWeather.weather.main, dayWeather.weather.id)}
                            {formatTemp(dayWeather.temp.max)}
                            {dayWeather.pop > 0.2 && (
                              <span className="text-blue-500 text-[10px]">{Math.round(dayWeather.pop * 100)}%</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {allActivitiesForDay.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">{allActivitiesForDay.length} activities</span>
                        )}
                        {calendarConnected && (() => {
                          const eventsForDay = getEventsForDate(dateStr)
                          return eventsForDay.length > 0 ? (
                            <span className="text-[10px] text-blue-500 ml-1">{eventsForDay.length} event{eventsForDay.length !== 1 ? 's' : ''}</span>
                          ) : null
                        })()}
                        {badWeather && hasOutdoorActivities && (
                          <span className="text-[10px] text-amber-600 ml-1">outdoor activities may be affected</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                </button>

                {isExpanded && (
                  <div
                    className="border-t p-3"
                    onPointerMove={handlePreviewPointerMove}
                    onPointerUp={handlePreviewPointerUp}
                    onPointerLeave={handlePreviewPointerUp}
                  >
                    {VISIBLE_TIME_BLOCKS.map(block => {
                      const activities = schedule.activities[block] || []
                      const deadlineLabel = TIME_BLOCK_DEADLINE_LABELS[block]
                      const isBlockDropTarget = previewDropTarget?.block === block && previewDragState?.sourceBlock !== block
                      // Get calendar events for this specific time block
                      const blockEvents = calendarConnected ? getEventsForTimeBlock(dateStr, block) : []

                      const showDropAtEnd = previewDropTarget &&
                        previewDropTarget.block === block &&
                        previewDropTarget.index === activities.length &&
                        previewDragState?.isDragging &&
                        !(previewDragState?.sourceBlock === block && previewDragState?.sourceIndex === activities.length - 1)

                      return (
                        <div
                          key={block}
                          ref={(el) => { previewBlockRefs.current[block] = el }}
                          className={cn(
                            "transition-colors",
                            isBlockDropTarget && "bg-primary/10 rounded-lg"
                          )}
                        >
                          {/* Calendar events for this time block */}
                          {blockEvents.length > 0 && (
                            <div className="space-y-1 mb-1">
                              {blockEvents.map(event => (
                                <CalendarEventListItem
                                  key={event.id}
                                  event={event}
                                  formatTime={formatEventTime}
                                />
                              ))}
                            </div>
                          )}

                          {/* Activities for this time block */}
                          <div className="space-y-1">
                            {activities.map((actId, idx) => renderPreviewActivityItem(actId, block, idx, dateStr))}
                            {showDropAtEnd && (
                              <div className="h-1 bg-primary rounded-full mx-2 my-1 animate-pulse" />
                            )}
                          </div>

                          {/* Time deadline divider - shows AFTER activities */}
                          <div className="flex items-center gap-3 py-2">
                            <div className="flex-1 border-t border-border" />
                            <span className="text-xs font-medium text-muted-foreground px-2">{deadlineLabel}</span>
                            <div className="flex-1 border-t border-border" />
                            <button
                              onClick={() => setAddToPreviewModal({ dateStr, block })}
                              className="p-1 rounded hover:bg-muted text-muted-foreground"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {swappingActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSwappingActivity(null)}>
            <div className="w-full max-w-sm bg-card rounded-2xl p-4 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Swap Activity</h3>
                <button onClick={() => setSwappingActivity(null)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">Replace <strong>{getActivity(swappingActivity.activityId)?.name}</strong> with:</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {getSwapOptions().map(activity => (
                  <button
                    key={activity.id}
                    onClick={() => handleSwapInPreview(swappingActivity.dateStr, swappingActivity.activityId, activity.id, swappingActivity.timeBlock)}
                    className="w-full rounded-lg border bg-card hover:border-primary text-left overflow-hidden"
                  >
                    {activity.spectrum && (
                      <SpectrumBar spectrum={activity.spectrum} size="sm" />
                    )}
                    <div className="p-3">
                      <span className="font-medium">{activity.name}</span>
                      <span className="text-xs text-muted-foreground block">{activity.duration} min</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {addToPreviewModal && (
          <AddActivityModal
            onClose={() => setAddToPreviewModal(null)}
            onAdd={handleAddToPreview}
            currentActivities={generatedSchedules[addToPreviewModal.dateStr]?.activities[addToPreviewModal.block] || []}
          />
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setStep('design_alternate')} disabled={isSaving}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button className="flex-1" onClick={saveSchedules} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Plan'}
          </Button>
        </div>
      </div>
    )
  }

  // ============ STEP 6: Done ============
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold">Week Planned!</h2>
        <p className="text-muted-foreground text-center">Your next 7 days are ready to go.</p>
      </div>
    )
  }

  return null
}

// Add Activity Modal Component
function AddActivityModal({
  onClose,
  onAdd,
  currentActivities
}: {
  onClose: () => void
  onAdd: (id: string) => void
  currentActivities: string[]
}) {
  const [search, setSearch] = useState('')
  const allActivities = useMemo(() => getAllActivities(), [])

  const filtered = useMemo(() => {
    return allActivities
      .filter(a => !currentActivities.includes(a.id))
      .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()))
  }, [allActivities, currentActivities, search])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card rounded-2xl p-4 space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Add Activity</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="space-y-2 overflow-y-auto flex-1">
          {filtered.map(activity => (
            <button
              key={activity.id}
              onClick={() => onAdd(activity.id)}
              className="w-full rounded-lg border bg-card hover:border-primary text-left overflow-hidden"
            >
              {activity.spectrum && (
                <SpectrumBar spectrum={activity.spectrum} size="sm" />
              )}
              <div className="p-3">
                <span className="font-medium">{activity.name}</span>
                <span className="text-xs text-muted-foreground block">{CATEGORIES[activity.category].name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
