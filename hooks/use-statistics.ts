'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useStorage, Completion } from './use-storage'
import { useActivities } from './use-activities'
import { getWeekStartDate, getWeekDates, formatDateISO } from '@/lib/date-utils'
import { SpectrumScores } from '@/lib/activities'

export interface DayStats {
  date: string
  dayName: string
  sessionCount: number
  estimatedMinutes: number
  spectrumMinutes: SpectrumScores  // Minutes weighted by spectrum (e.g., 10min activity with 80% heart = 8 heart minutes)
}

export interface ActivityBreakdown {
  activityId: string
  activityName: string
  sessionCount: number
  estimatedMinutes: number
  spectrum?: SpectrumScores
}

export interface MoodEntry {
  date: string
  category: string
  emotion?: string
  notes?: string
  savedAt: string
}

export interface WeeklyGoals {
  heart: number   // goal spectrum-weighted minutes
  mind: number
  body: number
  learn: number
  total: number   // sum of all 4
  isDefault: boolean  // true = auto-computed from schedule (75%), false = user-set
}

export interface WeekStats {
  weekStart: Date
  weekEnd: Date
  days: DayStats[]
  totalSessions: number
  totalMinutes: number         // Raw activity minutes (actual time spent)
  spectrumTotalMinutes: number // Sum of spectrum-weighted minutes (what the chart shows)
  spectrumTotals: SpectrumScores
  weeklyGoals: WeeklyGoals
  activityBreakdown: ActivityBreakdown[]
  moodEntries: MoodEntry[]
}

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const EMPTY_SPECTRUM: SpectrumScores = { heart: 0, mind: 0, body: 0, learn: 0 }

function addSpectrum(a: SpectrumScores, b: SpectrumScores): SpectrumScores {
  return {
    heart: a.heart + b.heart,
    mind: a.mind + b.mind,
    body: a.body + b.body,
    learn: a.learn + b.learn,
  }
}

export function useStatistics() {
  const storage = useStorage()
  const { getActivity, isLoading: activitiesLoading } = useActivities()
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Use refs to avoid re-creating computeWeekStats on every render
  const storageRef = useRef(storage)
  const getActivityRef = useRef(getActivity)
  storageRef.current = storage
  getActivityRef.current = getActivity

  const computeWeekStats = useCallback(async (offset: number): Promise<WeekStats> => {
    const today = new Date()
    const targetDate = new Date(today)
    targetDate.setDate(targetDate.getDate() + offset * 7)

    const weekStart = getWeekStartDate(targetDate)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekDates = getWeekDates(targetDate)

    // Fetch completions for each day
    const dayStatsArray: DayStats[] = []
    const allCompletions: Completion[] = []

    for (let i = 0; i < weekDates.length; i++) {
      const date = weekDates[i]
      const dateStr = formatDateISO(date)
      const completions = await storageRef.current.getCompletionsForDate(dateStr)
      allCompletions.push(...completions)

      let sessionCount = 0
      let estimatedMinutes = 0
      let spectrumMinutes: SpectrumScores = { ...EMPTY_SPECTRUM }

      for (const c of completions) {
        const activity = getActivityRef.current(c.activityId)
        if (!activity) continue

        sessionCount++
        const mins = c.durationMinutes ?? activity.duration ?? 5
        estimatedMinutes += mins

        if (activity.spectrum) {
          // Weight minutes by spectrum proportions (e.g., 10min * 0.8 heart = 8 heart minutes)
          spectrumMinutes = addSpectrum(spectrumMinutes, {
            heart: mins * (activity.spectrum.heart || 0),
            mind: mins * (activity.spectrum.mind || 0),
            body: mins * (activity.spectrum.body || 0),
            learn: mins * (activity.spectrum.learn || 0),
          })
        }
      }

      dayStatsArray.push({
        date: dateStr,
        dayName: SHORT_DAYS[i],
        sessionCount,
        estimatedMinutes,
        spectrumMinutes,
      })
    }

    // Compute totals
    let totalSessions = 0
    let totalMinutes = 0
    let spectrumTotals: SpectrumScores = { ...EMPTY_SPECTRUM }

    for (const day of dayStatsArray) {
      totalSessions += day.sessionCount
      totalMinutes += day.estimatedMinutes
      spectrumTotals = addSpectrum(spectrumTotals, day.spectrumMinutes)
    }

    // Sum of spectrum-weighted minutes (what the stacked chart actually shows)
    const spectrumTotalMinutes = Math.round(
      spectrumTotals.heart + spectrumTotals.mind + spectrumTotals.body + spectrumTotals.learn
    )

    // Activity breakdown
    const breakdownMap = new Map<string, ActivityBreakdown>()
    for (const c of allCompletions) {
      const activity = getActivityRef.current(c.activityId)
      if (!activity) continue

      const mins = c.durationMinutes ?? activity.duration ?? 5
      const existing = breakdownMap.get(c.activityId)
      if (existing) {
        existing.sessionCount++
        existing.estimatedMinutes += mins
      } else {
        breakdownMap.set(c.activityId, {
          activityId: c.activityId,
          activityName: activity.name,
          sessionCount: 1,
          estimatedMinutes: mins,
          spectrum: activity.spectrum,
        })
      }
    }

    const activityBreakdown = Array.from(breakdownMap.values())
      .sort((a, b) => b.sessionCount - a.sessionCount)

    // Fetch mood entries for the week
    const startDateStr = formatDateISO(weekStart)
    const endDateStr = formatDateISO(weekEnd)
    let moodEntries: MoodEntry[] = []
    try {
      const rawMoods = await storageRef.current.getMoodEntriesForRange(startDateStr, endDateStr)
      moodEntries = rawMoods.map(m => ({
        date: m.date,
        category: m.category,
        emotion: m.emotion,
        notes: m.notes,
        savedAt: m.savedAt,
      }))
    } catch (e) {
      console.error('Failed to fetch mood entries:', e)
    }

    // Compute weekly goals
    let weeklyGoals: WeeklyGoals
    const userGoals = await storageRef.current.getWeeklyGoals()

    if (userGoals) {
      // User has set custom goals
      weeklyGoals = {
        ...userGoals,
        total: userGoals.heart + userGoals.mind + userGoals.body + userGoals.learn,
        isDefault: false,
      }
    } else {
      // Compute default goals from scheduled activities (75% of scheduled spectrum-minutes)
      let scheduledSpectrum: SpectrumScores = { ...EMPTY_SPECTRUM }
      try {
        const scheduled = await storageRef.current.getScheduledActivitiesForRange(startDateStr, 7)
        for (const activityIds of Object.values(scheduled)) {
          for (const actId of activityIds) {
            const activity = getActivityRef.current(actId)
            if (!activity) continue
            const mins = activity.duration ?? 5
            if (activity.spectrum) {
              scheduledSpectrum = addSpectrum(scheduledSpectrum, {
                heart: mins * (activity.spectrum.heart || 0),
                mind: mins * (activity.spectrum.mind || 0),
                body: mins * (activity.spectrum.body || 0),
                learn: mins * (activity.spectrum.learn || 0),
              })
            }
          }
        }
      } catch (e) {
        console.error('Failed to compute scheduled goals:', e)
      }

      // 75% of scheduled total as default goal
      const factor = 0.75
      const heart = Math.round(scheduledSpectrum.heart * factor)
      const mind = Math.round(scheduledSpectrum.mind * factor)
      const body = Math.round(scheduledSpectrum.body * factor)
      const learn = Math.round(scheduledSpectrum.learn * factor)
      weeklyGoals = {
        heart, mind, body, learn,
        total: heart + mind + body + learn,
        isDefault: true,
      }
    }

    return {
      weekStart,
      weekEnd,
      days: dayStatsArray,
      totalSessions,
      totalMinutes,
      spectrumTotalMinutes,
      spectrumTotals,
      weeklyGoals,
      activityBreakdown,
      moodEntries,
    }
  }, []) // stable — uses refs internally

  // Load stats when offset or activities change
  useEffect(() => {
    if (activitiesLoading || !storage.isReady) return

    let cancelled = false
    setIsLoading(true)

    computeWeekStats(weekOffset).then(stats => {
      if (!cancelled) {
        setWeekStats(stats)
        setIsLoading(false)
      }
    }).catch(err => {
      console.error('Failed to compute week stats:', err)
      if (!cancelled) {
        setIsLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [weekOffset, activitiesLoading, storage.isReady, computeWeekStats])

  const goToPreviousWeek = useCallback(() => {
    setWeekOffset(prev => prev - 1)
  }, [])

  const goToNextWeek = useCallback(() => {
    setWeekOffset(prev => Math.min(prev + 1, 0))
  }, [])

  // Force re-computation of current week (e.g. after seeding demo data)
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  // Also respond to refreshKey changes
  useEffect(() => {
    if (refreshKey === 0) return // skip initial
    if (activitiesLoading || !storage.isReady) return

    let cancelled = false
    setIsLoading(true)

    computeWeekStats(weekOffset).then(stats => {
      if (!cancelled) {
        setWeekStats(stats)
        setIsLoading(false)
      }
    }).catch(err => {
      console.error('Failed to compute week stats on refresh:', err)
      if (!cancelled) setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [refreshKey]) // intentionally only depends on refreshKey

  const isCurrentWeek = weekOffset === 0

  const saveWeeklyGoals = useCallback(async (goals: { heart: number; mind: number; body: number; learn: number }) => {
    await storage.saveWeeklyGoals(goals)
    // Refresh to recompute with new goals
    setRefreshKey(k => k + 1)
  }, [storage])

  const clearWeeklyGoals = useCallback(async () => {
    await storage.clearWeeklyGoals()
    // Refresh to recompute with defaults
    setRefreshKey(k => k + 1)
  }, [storage])

  return {
    weekStats,
    isLoading,
    weekOffset,
    isCurrentWeek,
    goToPreviousWeek,
    goToNextWeek,
    refresh,
    saveWeeklyGoals,
    clearWeeklyGoals,
  }
}
