'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TimeBlock } from './use-storage'

// Strava sport_type/type -> candidate app activity IDs (first match wins)
const STRAVA_TYPE_CANDIDATES: Record<string, string[]> = {
  'Run': ['run'],
  'TrailRun': ['run'],
  'VirtualRun': ['run'],
  'Ride': ['biking'],
  'MountainBikeRide': ['biking'],
  'GravelRide': ['biking'],
  'VirtualRide': ['biking'],
  'EBikeRide': ['biking'],
  'Walk': ['walk_neighborhood', 'walk_greenlake', 'walk'],
  'Hike': ['walk_neighborhood', 'walk_greenlake', 'walk'],
  'WeightTraining': ['weights', 'dumbbell_presses', 'home_routine'],
  'Crossfit': ['weights', 'home_routine'],
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date_local: string
  elapsed_time: number
  moving_time: number
  distance: number
  kilojoules?: number
  average_heartrate?: number
  has_heartrate?: boolean
}

export interface StravaImportItem {
  stravaActivity: StravaActivity
  suggestedActivityId: string | null
  selectedActivityId: string | null
  selected: boolean
  durationMinutes: number
  date: string
  timeBlock: TimeBlock
}

export function getTimeBlockFromHour(hour: number): TimeBlock {
  if (hour < 6) return 'before6am'
  if (hour < 9) return 'before9am'
  if (hour < 12) return 'beforeNoon'
  if (hour < 14.5) return 'before230pm'
  if (hour < 17) return 'before5pm'
  return 'before9pm'
}

export function useStrava() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [athleteName, setAthleteName] = useState<string | null>(null)
  const [isFetchingActivities, setIsFetchingActivities] = useState(false)

  const checkStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/strava/status')
      const data = await response.json()
      setIsConnected(data.connected)
      setAthleteName(data.athleteName || null)
      if (data.error) setError(data.error)
    } catch (err) {
      console.error('Failed to check Strava status:', err)
      setError('Failed to check connection status')
    }
  }, [])

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      await checkStatus()
      setIsLoading(false)
    }
    init()
  }, [checkStatus])

  const connect = useCallback(() => {
    window.location.href = '/api/auth/strava'
  }, [])

  const disconnect = useCallback(async () => {
    try {
      await fetch('/api/auth/strava/disconnect', { method: 'POST' })
      setIsConnected(false)
      setAthleteName(null)
    } catch (err) {
      console.error('Failed to disconnect Strava:', err)
      setError('Failed to disconnect')
    }
  }, [])

  const fetchActivities = useCallback(async (daysBack: number = 7): Promise<StravaActivity[]> => {
    setIsFetchingActivities(true)
    setError(null)

    try {
      const after = Math.floor((Date.now() - daysBack * 24 * 60 * 60 * 1000) / 1000)
      const response = await fetch(`/api/strava/activities?after=${after}&per_page=50`)
      const data = await response.json()

      if (data.success && data.activities) {
        return data.activities
      } else if (data.error === 'not_connected') {
        setIsConnected(false)
        return []
      } else {
        setError(data.error || 'Failed to fetch activities')
        return []
      }
    } catch (err) {
      console.error('Failed to fetch Strava activities:', err)
      setError('Failed to fetch activities')
      return []
    } finally {
      setIsFetchingActivities(false)
    }
  }, [])

  const buildImportItems = useCallback((stravaActivities: StravaActivity[], availableActivityIds?: Set<string>): StravaImportItem[] => {
    return stravaActivities.map(activity => {
      const durationMinutes = Math.round(activity.moving_time / 60)
      const sportType = activity.sport_type || activity.type

      // Walk/Hike: pick Green Lake (≥45 min) vs Neighborhood (<45 min)
      const isWalkType = sportType === 'Walk' || sportType === 'Hike'
      let candidates: string[]
      if (isWalkType) {
        const preferred = durationMinutes >= 45 ? 'walk_greenlake' : 'walk_neighborhood'
        const fallback = durationMinutes >= 45 ? 'walk_neighborhood' : 'walk_greenlake'
        candidates = [preferred, fallback, 'walk']
      } else {
        candidates = STRAVA_TYPE_CANDIDATES[sportType] || []
      }

      // Find the best matching activity ID, validated against available IDs
      let suggestedId: string | null = null
      if (availableActivityIds) {
        suggestedId = candidates.find(id => availableActivityIds.has(id)) || null
      } else {
        suggestedId = candidates[0] || null
      }
      const date = activity.start_date_local.split('T')[0]
      const hour = parseInt(activity.start_date_local.split('T')[1]?.split(':')[0] || '9')
      const timeBlock = getTimeBlockFromHour(hour)

      return {
        stravaActivity: activity,
        suggestedActivityId: suggestedId,
        selectedActivityId: suggestedId,
        selected: suggestedId !== null,
        durationMinutes,
        date,
        timeBlock
      }
    })
  }, [])

  return {
    isConnected,
    isLoading,
    error,
    athleteName,
    isFetchingActivities,
    connect,
    disconnect,
    fetchActivities,
    buildImportItems,
    checkStatus
  }
}
