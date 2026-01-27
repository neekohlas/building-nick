'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, ACTIVITIES, CATEGORIES, Category, TimeBlock, DayType } from '@/lib/activities'
import { useStorage } from './use-storage'

interface NotionApiResponse {
  success: boolean
  source: 'notion' | 'local'
  activities: NotionActivity[]
  count?: number
  message?: string
  error?: string
}

interface NotionActivity {
  id: string
  name: string
  description: string
  category: string
  duration: number
  instructions: string
  quick?: boolean
  link?: string
  video?: string
  weather_dependent?: boolean
  outdoor?: boolean
  weekday_only?: boolean
  default_time_block?: TimeBlock
  day_type?: DayType
}

// Convert Notion API response to our Activity type
function notionToActivity(notion: NotionActivity): Activity {
  // Map category from Notion to our Category type
  let category: Category = 'mind_body'
  const rawCategory = notion.category?.toLowerCase().replace(/[^a-z_]/g, '_')
  if (rawCategory === 'physical' || rawCategory === 'physical_exercise') {
    category = 'physical'
  } else if (rawCategory === 'professional' || rawCategory === 'professional_goals') {
    category = 'professional'
  } else if (rawCategory === 'mind_body' || rawCategory === 'mindbody' || rawCategory === 'mind-body') {
    category = 'mind_body'
  }

  return {
    id: notion.id,
    name: notion.name,
    description: notion.description || '',
    category,
    duration: notion.duration || 5,
    quick: notion.quick || notion.duration <= 5,
    instructions: notion.instructions || '',
    link: notion.link,
    weatherDependent: notion.weather_dependent,
    outdoor: notion.outdoor,
    weekdayOnly: notion.weekday_only,
    defaultTimeBlock: notion.default_time_block,
    dayType: notion.day_type
  }
}

export function useActivities() {
  const storage = useStorage()
  const [activities, setActivities] = useState<Record<string, Activity>>(ACTIVITIES)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [source, setSource] = useState<'notion' | 'local' | 'cached'>('local')
  const [error, setError] = useState<string | null>(null)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)

  // Load cached activities on mount
  useEffect(() => {
    if (!storage.isReady) return

    const loadCached = async () => {
      try {
        setIsLoading(true)

        // Try to load from cache first
        const cached = await storage.getCachedActivities()
        const syncTime = await storage.getActivitiesSyncTime()

        if (Object.keys(cached).length > 0) {
          // Convert cached data to Activity type
          const cachedActivities: Record<string, Activity> = {}
          for (const [id, data] of Object.entries(cached)) {
            cachedActivities[id] = data as Activity
          }
          setActivities(cachedActivities)
          setSource('cached')
          setLastSyncTime(syncTime)
          console.log(`Loaded ${Object.keys(cachedActivities).length} activities from cache (synced: ${syncTime})`)
        } else {
          // No cache, use local fallback
          setActivities(ACTIVITIES)
          setSource('local')
          console.log('No cached activities, using local fallback')
        }
      } catch (err) {
        console.error('Failed to load cached activities:', err)
        setActivities(ACTIVITIES)
        setSource('local')
      } finally {
        setIsLoading(false)
      }
    }

    loadCached()
  }, [storage.isReady, storage.getCachedActivities, storage.getActivitiesSyncTime])

  // Sync from Notion (manual trigger)
  const syncFromNotion = useCallback(async () => {
    try {
      setIsSyncing(true)
      setError(null)

      const response = await fetch('/api/activities')
      const data: NotionApiResponse = await response.json()

      if (data.success && data.source === 'notion' && data.activities.length > 0) {
        // Convert Notion activities to our format
        const notionActivities: Record<string, Activity> = {}
        data.activities.forEach(na => {
          const activity = notionToActivity(na)
          notionActivities[activity.id] = activity
        })

        // Save to cache
        await storage.saveActivities(notionActivities)

        setActivities(notionActivities)
        setSource('notion')
        setLastSyncTime(new Date().toISOString())
        console.log(`Synced ${data.count} activities from Notion`)

        return { success: true, count: data.count }
      } else {
        // Notion not configured or no activities
        console.log('Notion sync failed:', data.message || 'No activities')
        return { success: false, message: data.message || 'Notion not configured' }
      }
    } catch (err) {
      console.error('Failed to sync from Notion:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' }
    } finally {
      setIsSyncing(false)
    }
  }, [storage])

  // Helper functions that mirror lib/activities.tsx
  const getAllActivities = useCallback(() => {
    return Object.values(activities)
  }, [activities])

  const getActivitiesByCategory = useCallback((category: Category) => {
    return Object.values(activities).filter(a => a.category === category)
  }, [activities])

  const getPlanableActivities = useCallback(() => {
    return Object.values(activities).filter(a =>
      // Exclude variants
      !a.parentActivityId &&
      // Exclude "Untitled" entries
      a.name !== 'Untitled' &&
      (
        // Physical activities (don't require frequency for Notion activities)
        a.category === 'physical' ||
        // Professional activities
        a.category === 'professional' ||
        // Longer mind-body activities
        (a.category === 'mind_body' && !a.quick)
      )
    )
  }, [activities])

  const getQuickMindBodyActivities = useCallback(() => {
    return Object.values(activities).filter(a => a.category === 'mind_body' && a.quick)
  }, [activities])

  const getLongerMindBodyActivities = useCallback(() => {
    return Object.values(activities).filter(a => a.category === 'mind_body' && !a.quick)
  }, [activities])

  const getActivity = useCallback((id: string): Activity | undefined => {
    return activities[id]
  }, [activities])

  return {
    activities,
    isLoading,
    isSyncing,
    source,
    error,
    lastSyncTime,
    syncFromNotion,
    // Helper functions
    getAllActivities,
    getActivitiesByCategory,
    getPlanableActivities,
    getQuickMindBodyActivities,
    getLongerMindBodyActivities,
    getActivity
  }
}
