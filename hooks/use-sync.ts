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

interface SyncState {
  status: SyncStatus
  lastSyncTime: Date | null
  pendingOperations: number
  hasPendingMigration: boolean
}

export function useSync() {
  const { user, isAuthenticated, isSupabaseEnabled } = useAuth()
  const storage = useStorage()

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastSyncTime: null,
    pendingOperations: 0,
    hasPendingMigration: false,
  })

  // Debounce timers
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingOpsRef = useRef<Map<string, () => Promise<void>>>(new Map())

  // Check for migration on first auth
  useEffect(() => {
    if (!isAuthenticated || !user || !isSupabaseEnabled) return

    const checkMigration = async () => {
      // Check if user has cloud data
      const hasCloud = await hasCloudData(user.id)

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
        await pullFromCloud()
      }
    }

    checkMigration()
  }, [isAuthenticated, user, isSupabaseEnabled])

  // Queue a sync operation with debouncing
  const queueSync = useCallback((key: string, operation: () => Promise<void>) => {
    if (!isAuthenticated || !user) return

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
  }, [isAuthenticated, user])

  // Sync-aware save completion
  const saveCompletionWithSync = useCallback(async (
    completion: Omit<Completion, 'id' | 'completedAt'>
  ) => {
    // Save locally first (optimistic)
    await storage.saveCompletion(completion)

    // Queue cloud sync
    if (isAuthenticated && user) {
      const fullCompletion: Completion = {
        ...completion,
        id: `${completion.date}_${completion.activityId}`,
        completedAt: new Date().toISOString(),
      }
      queueSync(`completion-${fullCompletion.id}`, () =>
        syncCompletion(fullCompletion, user.id).then(() => {})
      )
    }
  }, [storage.saveCompletion, isAuthenticated, user, queueSync])

  // Sync-aware remove completion
  const removeCompletionWithSync = useCallback(async (date: string, activityId: string) => {
    // Remove locally first
    await storage.removeCompletion(date, activityId)

    // Queue cloud sync
    if (isAuthenticated && user) {
      const completionId = `${date}_${activityId}`
      queueSync(`remove-${completionId}`, () =>
        removeCompletionFromCloud(completionId, user.id).then(() => {})
      )
    }
  }, [storage.removeCompletion, isAuthenticated, user, queueSync])

  // Sync-aware save schedule
  const saveDailyScheduleWithSync = useCallback(async (schedule: DailySchedule) => {
    // Save locally first
    await storage.saveDailySchedule(schedule)

    // Queue cloud sync
    if (isAuthenticated && user) {
      queueSync(`schedule-${schedule.date}`, () =>
        syncSchedule(schedule, user.id).then(() => {})
      )
    }
  }, [storage.saveDailySchedule, isAuthenticated, user, queueSync])

  // Sync-aware save plan config
  const savePlanConfigWithSync = useCallback(async (
    config: Omit<SavedPlanConfig, 'id' | 'savedAt'>
  ) => {
    // Save locally first
    await storage.savePlanConfig(config)

    // Queue cloud sync
    if (isAuthenticated && user) {
      const fullConfig: SavedPlanConfig = {
        ...config,
        id: 'latest',
        savedAt: new Date().toISOString(),
      }
      queueSync('planConfig-latest', () =>
        syncPlanConfig(fullConfig, user.id).then(() => {})
      )
    }
  }, [storage.savePlanConfig, isAuthenticated, user, queueSync])

  // Pull all data from cloud and merge into local storage
  const pullFromCloud = useCallback(async () => {
    if (!isAuthenticated || !user) return

    setSyncState(prev => ({ ...prev, status: 'syncing' }))

    try {
      const cloudData = await pullAllFromCloud(user.id)

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
        for (const schedule of cloudData.schedules) {
          await storage.saveDailySchedule(schedule)
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

        console.log('Pulled data from cloud:', {
          completions: cloudData.completions.length,
          schedules: cloudData.schedules.length,
          planConfigs: cloudData.planConfigs.length,
        })
      }

      setSyncState(prev => ({
        ...prev,
        status: 'idle',
        lastSyncTime: new Date(),
      }))
    } catch (error) {
      console.error('Pull from cloud error:', error)
      setSyncState(prev => ({ ...prev, status: 'error' }))
    }
  }, [isAuthenticated, user, storage])

  // Migrate local data to cloud (first-time sync)
  const migrateToCloud = useCallback(async () => {
    if (!isAuthenticated || !user) return { success: false }

    setSyncState(prev => ({ ...prev, status: 'syncing' }))

    try {
      // Gather all local data
      const completions = await getAllCompletions()
      const schedules = await getAllSchedules()
      const planConfig = await storage.getLastPlanConfig()

      const result = await pushAllToCloud(user.id, {
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
  }, [isAuthenticated, user, storage])

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
