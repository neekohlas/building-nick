'use client'

import { useState, useCallback, useRef } from 'react'
import { useActivities } from './use-activities'
import { useStorage } from './use-storage'

export interface CoachSuggestion {
  activityId: string
  activityName: string
  reasoning: string
  timeBlock?: string
}

export interface ActivityRecap {
  activityId: string
  activityName: string
  count: number
  lastCompleted: string
}

type CoachPhase = 'loading' | 'recap' | 'feeling' | 'suggestions' | 'choice'

interface CoachState {
  isLoading: boolean
  error: string | null
  phase: CoachPhase
  // Recap data
  recentActivities: ActivityRecap[]
  hasRecentActivity: boolean
  // Suggestions data
  message: string | null
  suggestions: CoachSuggestion[]
  followUpQuestion: string | null
}

export function useCoach() {
  const { getActivity, getActivitiesByCategory } = useActivities()
  const storage = useStorage()

  // Use refs to avoid stale closure issues
  const storageRef = useRef(storage)
  storageRef.current = storage

  const getActivityRef = useRef(getActivity)
  getActivityRef.current = getActivity

  const getActivitiesByCategoryRef = useRef(getActivitiesByCategory)
  getActivitiesByCategoryRef.current = getActivitiesByCategory

  const [state, setState] = useState<CoachState>({
    isLoading: false,
    error: null,
    phase: 'loading',
    recentActivities: [],
    hasRecentActivity: false,
    message: null,
    suggestions: [],
    followUpQuestion: null
  })

  // Get recent mind-body activity patterns from storage
  const getRecentMindBodyPatterns = useCallback(async () => {
    const currentStorage = storageRef.current
    const currentGetActivity = getActivityRef.current

    console.log('getRecentMindBodyPatterns called, storage.isReady:', currentStorage.isReady)
    if (!currentStorage.isReady) {
      console.log('Storage not ready, returning empty array')
      return []
    }

    // Get completions from the last 4 weeks
    const today = new Date()
    const fourWeeksAgo = new Date(today)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const patterns: Map<string, { count: number; lastCompleted: string }> = new Map()

    // Build array of dates to query
    const dates: string[] = []
    for (let d = new Date(fourWeeksAgo); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0])
    }

    console.log('Querying', dates.length, 'dates for completions...')

    // Query all dates in parallel for better performance
    const allCompletions = await Promise.all(
      dates.map(dateStr => currentStorage.getCompletionsForDate(dateStr))
    )

    console.log('Got completions from all dates')

    // Process all completions
    allCompletions.forEach((completions, index) => {
      const dateStr = dates[index]
      for (const completion of completions) {
        // Only count mind-body activities
        const activity = currentGetActivity(completion.activityId)
        if (activity?.category !== 'mind_body') continue

        const existing = patterns.get(completion.activityId) || { count: 0, lastCompleted: '' }
        patterns.set(completion.activityId, {
          count: existing.count + 1,
          lastCompleted: dateStr > existing.lastCompleted ? dateStr : existing.lastCompleted
        })
      }
    })

    console.log('Found', patterns.size, 'mind-body activity patterns')

    // Convert to array with activity details, sorted by count descending
    return Array.from(patterns.entries())
      .map(([activityId, data]) => {
        const activity = currentGetActivity(activityId)
        return {
          activityId,
          activityName: activity?.name || activityId,
          count: data.count,
          lastCompleted: data.lastCompleted
        }
      })
      .sort((a, b) => b.count - a.count)
  }, []) // No dependencies - uses refs

  // Initialize - load recap data
  const initialize = useCallback(async () => {
    console.log('Coach initialize called, storage.isReady:', storageRef.current.isReady)
    setState(prev => ({ ...prev, isLoading: true, error: null, phase: 'loading' }))

    try {
      console.log('Getting recent mind-body patterns...')
      const recentActivities = await getRecentMindBodyPatterns()
      const hasRecentActivity = recentActivities.length > 0
      console.log('Got patterns:', recentActivities.length, 'hasRecentActivity:', hasRecentActivity)

      // Always go to feeling phase — the coach starts by asking how you're feeling
      const nextPhase = 'feeling' as CoachPhase
      console.log('Setting phase to:', nextPhase)

      setState(prev => {
        console.log('setState callback: transitioning to', nextPhase, 'phase')
        return {
          ...prev,
          isLoading: false,
          phase: nextPhase,
          recentActivities,
          hasRecentActivity
        }
      })
      console.log('setState called for', nextPhase, 'phase')
    } catch (error) {
      console.error('Coach init error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [getRecentMindBodyPatterns])

  // User chooses to continue with similar activities — skip AI, use recent activities directly
  const continueSimilar = useCallback(() => {
    setState(prev => {
      const suggestions = prev.recentActivities.slice(0, 5).map(a => ({
        activityId: a.activityId,
        activityName: a.activityName,
        reasoning: `You've done this ${a.count} time${a.count !== 1 ? 's' : ''} recently`
      }))

      return {
        ...prev,
        phase: 'suggestions',
        message: 'Keep up the momentum! Here are your recent activities — select the ones you want to continue with.',
        suggestions
      }
    })
  }, [])

  // User chooses to personalize - go to feeling phase
  const startPersonalize = useCallback(() => {
    setState(prev => ({ ...prev, phase: 'feeling' }))
  }, [])

  // Get personalized suggestions based on how they're feeling
  const getPersonalizedSuggestions = useCallback(async (feeling: string) => {
    setState(prev => {
      // Capture recentActivities from current state
      const recentActivities = prev.recentActivities

      const doFetch = async () => {
        try {
          const mindBodyActivities = getActivitiesByCategoryRef.current('mind_body')
          const availableActivities = mindBodyActivities.map(a => ({
            id: a.id,
            name: a.name,
            category: a.category,
            description: a.description,
            duration: a.duration,
            favorite: a.favorite || false
          }))

          const response = await fetch('/api/coach/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'personalized',
              recentPatterns: recentActivities.map(a => ({
                activityId: a.activityId,
                activityName: a.activityName,
                category: 'mind_body',
                completionCount: a.count,
                lastCompleted: a.lastCompleted
              })),
              availableActivities,
              userFeeling: feeling
            })
          })

          const data = await response.json()

          if (data.success) {
            setState(p => ({
              ...p,
              isLoading: false,
              phase: 'suggestions',
              message: data.message,
              suggestions: data.suggestions || [],
              followUpQuestion: data.followUpQuestion || null
            }))
          } else {
            setState(p => ({
              ...p,
              isLoading: false,
              error: data.error || 'Failed to get suggestions'
            }))
          }
        } catch (error) {
          console.error('Coach error:', error)
          setState(p => ({
            ...p,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }))
        }
      }

      doFetch()

      return { ...prev, isLoading: true, error: null }
    })
  }, []) // No dependencies - uses refs and state updater

  // Get more suggestions (keeps selected ones, adds new ones)
  const refreshSuggestions = useCallback((keepActivityIds: string[] = []) => {
    setState(prev => {
      // Capture state for the async operation
      const recentActivities = prev.recentActivities
      const currentSuggestions = prev.suggestions
      // Keep suggestions that user has selected
      const keptSuggestions = currentSuggestions.filter(s => keepActivityIds.includes(s.activityId))

      const doFetch = async () => {
        try {
          const mindBodyActivities = getActivitiesByCategoryRef.current('mind_body')
          const availableActivities = mindBodyActivities.map(a => ({
            id: a.id,
            name: a.name,
            category: a.category,
            description: a.description,
            duration: a.duration,
            favorite: a.favorite || false
          }))

          const response = await fetch('/api/coach/suggest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'refresh',
              recentPatterns: recentActivities.map(a => ({
                activityId: a.activityId,
                activityName: a.activityName,
                category: 'mind_body',
                completionCount: a.count,
                lastCompleted: a.lastCompleted
              })),
              availableActivities,
              // Tell the API which suggestions to avoid (all current ones including kept ones, so we get fresh ones)
              excludeSuggestions: currentSuggestions.map(s => s.activityId)
            })
          })

          const data = await response.json()

          if (data.success) {
            // Combine kept suggestions with new ones
            const newSuggestions = data.suggestions || []
            const combinedSuggestions = [...keptSuggestions, ...newSuggestions]

            setState(p => ({
              ...p,
              isLoading: false,
              phase: 'suggestions',
              message: data.message,
              suggestions: combinedSuggestions,
              followUpQuestion: data.followUpQuestion || null
            }))
          } else {
            setState(p => ({
              ...p,
              isLoading: false,
              error: data.error || 'Failed to get suggestions'
            }))
          }
        } catch (error) {
          console.error('Coach refresh error:', error)
          setState(p => ({
            ...p,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }))
        }
      }

      doFetch()

      return { ...prev, isLoading: true, error: null }
    })
  }, []) // No dependencies - uses refs and state updater

  // Reset the conversation
  const resetConversation = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      phase: 'loading',
      recentActivities: [],
      hasRecentActivity: false,
      message: null,
      suggestions: [],
      followUpQuestion: null
    })
  }, [])

  return {
    ...state,
    storageReady: storage.isReady,
    initialize,
    continueSimilar,
    startPersonalize,
    getPersonalizedSuggestions,
    refreshSuggestions,
    resetConversation
  }
}
