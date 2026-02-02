'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './use-auth'
import { useStorage, Completion, DailySchedule, SavedPlanConfig } from './use-storage'
import {
  syncCompletion,
  removeCompletionFromCloud,
  syncSchedule,
  syncPlanConfig,
  pullAllFromCloud,
  pushAllToCloud,
  hasCloudData,
  SyncStatus,
} from '@/lib/sync-service'

// Debounce time for sync operations (ms)
const SYNC_DEBOUNCE = 2000

// How often to poll for cloud updates (ms) - 30 seconds
const POLL_INTERVAL = 30000

interface SyncState {
  status: SyncStatus
  lastSyncTime: Date | null
  pendingOperations: number
  hasPendingMigration: boolean
  lastPullTime: Date | null  // Increments when cloud data is pulled - components can watch this to re-fetch
}

export function useSync() {
  const { userId, isAuthenticated, isSupabaseEnabled } = useAuth()
  const storage = useStorage()

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncTime: null,
    pendingOperations: 0,
    hasPendingMigration: false,
    lastPullTime: null,
  })

  // Debounce timers
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingOpsRef = useRef<Map<string, () => Promise<void>>>(new Map())

  // Track if initial sync is done
  const initialSyncDoneRef = useRef(false)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Queue a sync operation with debouncing
  const queueSync = useCallback((key: string, operation: () => Promise<void>) => {
    if (!isAuthenticated || !userId) {
      return
    }

    pendingOpsRef.current.set(key, operation)
    setSyncState(prev => ({ ...prev, pendingOperations: pendingOpsRef.current.size }))

    // Clear existing timer
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    // Set new timer
    syncTimerRef.current = setTimeout(async () => {
      setSyncState(prev => ({ ...prev, status: 'syncing' }))

      const ops = Array.from(pendingOpsRef.current.values())
      pendingOpsRef.current.clear()

      try {
        await Promise.all(ops.map(op => op()))
        setSyncState(prev => ({
          ...prev,
          status: 'idle',
          lastSyncTime: new Date(),
          pendingOperations: 0,
        }))
      } catch (error) {
        console.error('Sync error:', error)
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          pendingOperations: 0,
        }))
      }
    }, SYNC_DEBOUNCE)
  }, [isAuthenticated, userId])

  // Sync-aware save completion
  const saveCompletionWithSync = useCallback(async (
    completion: Omit<Completion, 'id' | 'completedAt'>
  ) => {
    // Save locally first (optimistic)
    await storage.saveCompletion(completion)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const fullCompletion: Completion = {
        ...completion,
        id: `${completion.date}_${completion.activityId}`,
        completedAt: new Date().toISOString(),
      }
      queueSync(`completion-${fullCompletion.id}`, () =>
        syncCompletion(fullCompletion, userId).then(() => {})
      )
    }
  }, [storage.saveCompletion, isAuthenticated, userId, queueSync])

  // Sync-aware remove completion
  const removeCompletionWithSync = useCallback(async (date: string, activityId: string) => {
    // Remove locally first
    await storage.removeCompletion(date, activityId)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const completionId = `${date}_${activityId}`
      queueSync(`remove-${completionId}`, () =>
        removeCompletionFromCloud(completionId, userId).then(() => {})
      )
    }
  }, [storage.removeCompletion, isAuthenticated, userId, queueSync])

  // Sync-aware save schedule
  const saveDailyScheduleWithSync = useCallback(async (schedule: DailySchedule) => {
    // Save locally first
    await storage.saveDailySchedule(schedule)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      queueSync(`schedule-${schedule.date}`, () =>
        syncSchedule(schedule, userId).then(() => {})
      )
    }
  }, [storage.saveDailySchedule, isAuthenticated, userId, queueSync])

  // Sync-aware save plan config
  const savePlanConfigWithSync = useCallback(async (
    config: Omit<SavedPlanConfig, 'id' | 'savedAt'>
  ) => {
    // Save locally first
    await storage.savePlanConfig(config)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const fullConfig: SavedPlanConfig = {
        ...config,
        id: 'latest',
        savedAt: new Date().toISOString(),
      }
      queueSync('planConfig-latest', () =>
        syncPlanConfig(fullConfig, userId).then(() => {})
      )
    }
  }, [storage.savePlanConfig, isAuthenticated, userId, queueSync])

  // Pull all data from cloud and merge into local storage
  const pullFromCloud = useCallback(async () => {
    if (!isAuthenticated || !userId) return

    // Don't pull while there are pending sync operations to avoid conflicts
    if (pendingOpsRef.current.size > 0) {
      console.log('[useSync] Skipping pull - pending operations:', pendingOpsRef.current.size)
      return
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }))

    try {
      const cloudData = await pullAllFromCloud(userId)

      if (cloudData) {
        // Merge completions - cloud data overwrites local for same IDs
        for (const completion of cloudData.completions) {
          await storage.saveCompletion({
            date: completion.date,
            activityId: completion.activityId,
            timeBlock: completion.timeBlock,
          })
        }

        // Merge schedules - cloud data overwrites local for same dates
        // Deduplicate activities within each time block
        for (const schedule of cloudData.schedules) {
          const deduplicatedSchedule = {
            ...schedule,
            activities: Object.fromEntries(
              Object.entries(schedule.activities).map(([block, activityIds]) => [
                block,
                [...new Set(activityIds as string[])]
              ])
            )
          }
          await storage.saveDailySchedule(deduplicatedSchedule)
        }

        // Use latest plan config from cloud
        if (cloudData.planConfigs.length > 0) {
          const latestConfig = cloudData.planConfigs.find(c => c.id === 'latest')
          if (latestConfig) {
            await storage.savePlanConfig({
              selectedActivities: latestConfig.selectedActivities,
              frequencies: latestConfig.frequencies,
              heavyDaySchedule: latestConfig.heavyDaySchedule,
              lightDaySchedule: latestConfig.lightDaySchedule,
              startWithHeavy: latestConfig.startWithHeavy,
            })
          }
        }

        console.log('[useSync] Pulled data from cloud:', {
          completions: cloudData.completions.length,
          schedules: cloudData.schedules.length,
          planConfigs: cloudData.planConfigs.length,
        })
      }

      const now = new Date()
      setSyncState(prev => ({
        ...prev,
        status: 'idle',
        lastSyncTime: now,
        lastPullTime: cloudData ? now : prev.lastPullTime,  // Only update if we got data
      }))
    } catch (error) {
      console.error('[useSync] Pull from cloud error:', error)
      setSyncState(prev => ({ ...prev, status: 'error' }))
    }
  }, [isAuthenticated, userId, storage])

  // Store pullFromCloud in a ref so effects can access latest version
  const pullFromCloudRef = useRef(pullFromCloud)
  useEffect(() => {
    pullFromCloudRef.current = pullFromCloud
  }, [pullFromCloud])

  // Check for migration on first load (when cloud sync is enabled)
  useEffect(() => {
    if (!isAuthenticated || !userId || !isSupabaseEnabled) {
      console.log('[useSync] Skipping migration check:', { isAuthenticated, userId: !!userId, isSupabaseEnabled })
      return
    }

    const checkMigration = async () => {
      console.log('[useSync] Starting migration check...')
      try {
        // Check if user has cloud data
        const hasCloud = await hasCloudData(userId)
        console.log('[useSync] hasCloudData:', hasCloud)

        if (!hasCloud) {
          // Check if there's local data to migrate
          const [completions, planConfig] = await Promise.all([
            storage.getCompletionStats(365), // Get stats for last year
            storage.getLastPlanConfig(),
          ])

          if (completions.total > 0 || planConfig) {
            setSyncState(prev => ({ ...prev, hasPendingMigration: true }))
          }
        } else {
          // User has cloud data, pull it
          await pullFromCloudRef.current()
        }
      } catch (error) {
        console.error('[useSync] Migration check error:', error)
      } finally {
        // Always mark initial sync as done so polling can start
        initialSyncDoneRef.current = true
        console.log('[useSync] Initial sync done, polling can start')
      }
    }

    checkMigration()
  }, [isAuthenticated, userId, isSupabaseEnabled])

  // Set up polling for cloud updates
  useEffect(() => {
    if (!isAuthenticated || !userId || !isSupabaseEnabled) {
      return
    }

    // Start polling after a short delay to let initial sync complete
    const startPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }

      console.log('[useSync] Polling started! Interval:', POLL_INTERVAL, 'ms')

      pollIntervalRef.current = setInterval(async () => {
        // Only poll if initial sync is done
        if (initialSyncDoneRef.current) {
          console.log('[useSync] Polling for cloud updates...')
          try {
            await pullFromCloudRef.current()
          } catch (error) {
            console.error('[useSync] Polling error:', error)
          }
        } else {
          console.log('[useSync] Polling skipped - initial sync not done yet')
        }
      }, POLL_INTERVAL)
    }

    // Start polling after 5 seconds (let initial sync complete first)
    const startupTimer = setTimeout(startPolling, 5000)

    return () => {
      console.log('[useSync] Cleaning up polling')
      clearTimeout(startupTimer)
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [isAuthenticated, userId, isSupabaseEnabled])

  // Pull from cloud when app becomes visible (user switches back to tab/app)
  useEffect(() => {
    if (!isAuthenticated || !userId || !isSupabaseEnabled) return

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && initialSyncDoneRef.current) {
        console.log('[useSync] App became visible, pulling from cloud...')
        try {
          await pullFromCloudRef.current()
        } catch (error) {
          console.error('[useSync] Visibility sync error:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, userId, isSupabaseEnabled])

  // Migrate local data to cloud (first-time sync)
  const migrateToCloud = useCallback(async () => {
    if (!isAuthenticated || !userId) return { success: false }

    setSyncState(prev => ({ ...prev, status: 'syncing' }))

    try {
      // Gather all local data
      const completions = await getAllCompletions()
      const schedules = await getAllSchedules()
      const planConfig = await storage.getLastPlanConfig()

      const result = await pushAllToCloud(userId, {
        completions,
        schedules,
        planConfig,
      })

      if (result.success) {
        setSyncState(prev => ({
          ...prev,
          status: 'idle',
          lastSyncTime: new Date(),
          hasPendingMigration: false,
        }))
      } else {
        setSyncState(prev => ({ ...prev, status: 'error' }))
      }

      return result
    } catch (error) {
      console.error('Migration error:', error)
      setSyncState(prev => ({ ...prev, status: 'error' }))
      return { success: false, error: String(error) }
    }
  }, [isAuthenticated, userId, storage])

  // Helper to get all completions (not exposed by storage hook directly)
  const getAllCompletions = useCallback(async (): Promise<Completion[]> => {
    // Get completions for the last 365 days
    const completions: Completion[] = []
    const today = new Date()

    for (let i = 0; i < 365; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayCompletions = await storage.getCompletionsForDate(dateStr)
      completions.push(...dayCompletions)
    }

    return completions
  }, [storage])

  // Helper to get all schedules
  const getAllSchedules = useCallback(async (): Promise<DailySchedule[]> => {
    const schedules: DailySchedule[] = []
    const today = new Date()

    // Get schedules for past 30 days and next 30 days
    for (let i = -30; i <= 30; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]
      const schedule = await storage.getDailySchedule(dateStr)
      if (schedule) {
        schedules.push(schedule)
      }
    }

    return schedules
  }, [storage])

  // Dismiss migration prompt
  const dismissMigration = useCallback(() => {
    setSyncState(prev => ({ ...prev, hasPendingMigration: false }))
  }, [])

  return {
    // Sync state
    syncStatus: syncState.status,
    lastSyncTime: syncState.lastSyncTime,
    lastPullTime: syncState.lastPullTime,  // Components can watch this to re-fetch data
    pendingOperations: syncState.pendingOperations,
    hasPendingMigration: syncState.hasPendingMigration,

    // Sync-aware storage operations
    saveCompletion: saveCompletionWithSync,
    removeCompletion: removeCompletionWithSync,
    saveDailySchedule: saveDailyScheduleWithSync,
    savePlanConfig: savePlanConfigWithSync,

    // Pass-through to original storage (for reads)
    ...storage,

    // Override the write operations with sync versions
    saveCompletion: saveCompletionWithSync,
    removeCompletion: removeCompletionWithSync,
    saveDailySchedule: saveDailyScheduleWithSync,
    savePlanConfig: savePlanConfigWithSync,

    // Sync actions
    pullFromCloud,
    migrateToCloud,
    dismissMigration,
  }
}
