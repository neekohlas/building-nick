'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './use-auth'
import { useStorage, Completion, DailySchedule, SavedPlanConfig } from './use-storage'
import {
  syncCompletion,
  removeCompletionFromCloud,
  syncSchedule,
  syncPlanConfig,
  deleteRoutineFromCloud,
  pullAllFromCloud,
  pushAllToCloud,
  hasCloudData,
  syncRemindersToCloud,
  updateReminderCompletionInCloud,
  syncMoodEntry,
  SyncStatus,
} from '@/lib/sync-service'
import {
  getStoredReminders,
  saveReminders,
  toggleReminderCompletion as toggleReminderCompletionLocal,
  deduplicateReminders,
  type Reminder,
} from '@/lib/reminders'

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
    console.log('[useSync] queueSync called:', { key, isAuthenticated, userId: !!userId })
    if (!isAuthenticated || !userId) {
      console.log('[useSync] queueSync skipped - not authenticated')
      return
    }

    pendingOpsRef.current.set(key, operation)
    console.log('[useSync] Operation queued, pending ops:', pendingOpsRef.current.size)
    setSyncState(prev => ({ ...prev, pendingOperations: pendingOpsRef.current.size }))

    // Clear existing timer
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
    }

    // Set new timer
    syncTimerRef.current = setTimeout(async () => {
      console.log('[useSync] Executing queued sync operations...')
      setSyncState(prev => ({ ...prev, status: 'syncing' }))

      const ops = Array.from(pendingOpsRef.current.values())
      pendingOpsRef.current.clear()
      console.log('[useSync] Running', ops.length, 'sync operations')

      try {
        await Promise.all(ops.map(op => op()))
        console.log('[useSync] Sync operations completed successfully')
        setSyncState(prev => ({
          ...prev,
          status: 'idle',
          lastSyncTime: new Date(),
          pendingOperations: 0,
        }))
      } catch (error) {
        console.error('[useSync] Sync error:', error)
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          pendingOperations: 0,
        }))
      }
    }, SYNC_DEBOUNCE)
  }, [isAuthenticated, userId])

  // Sync-aware save completion (instance-based)
  const saveCompletionWithSync = useCallback(async (
    completion: Omit<Completion, 'id' | 'completedAt'>
  ) => {
    console.log('[useSync] saveCompletionWithSync called:', {
      completion,
      isAuthenticated,
      userId: userId ? userId.substring(0, 8) + '...' : null,
    })

    // Save locally first (optimistic)
    await storage.saveCompletion(completion)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const fullCompletion: Completion = {
        ...completion,
        id: `${completion.date}_${completion.activityId}_${completion.timeBlock}_${completion.instanceIndex}`,
        completedAt: new Date().toISOString(),
      }
      console.log('[useSync] Queueing completion sync:', fullCompletion.id)
      queueSync(`completion-${fullCompletion.id}`, () =>
        syncCompletion(fullCompletion, userId).then(() => {})
      )
    } else {
      console.log('[useSync] Skipping cloud sync - not authenticated')
    }
  }, [storage.saveCompletion, isAuthenticated, userId, queueSync])

  // Sync-aware remove completion (instance-based)
  const removeCompletionWithSync = useCallback(async (
    date: string,
    activityId: string,
    timeBlock: string,
    instanceIndex: number
  ) => {
    console.log('[useSync] removeCompletionWithSync called:', {
      date,
      activityId,
      timeBlock,
      instanceIndex,
      isAuthenticated,
      userId: userId ? userId.substring(0, 8) + '...' : null,
    })

    // Remove locally first
    await storage.removeCompletion(date, activityId, timeBlock, instanceIndex)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const completionId = `${date}_${activityId}_${timeBlock}_${instanceIndex}`
      console.log('[useSync] Queueing completion removal:', completionId)
      queueSync(`remove-${completionId}`, () =>
        removeCompletionFromCloud(completionId, userId).then(() => {})
      )
    } else {
      console.log('[useSync] Skipping cloud removal - not authenticated')
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

  // Sync-aware save plan config (also auto-saves a routine)
  const savePlanConfigWithSync = useCallback(async (
    config: Omit<SavedPlanConfig, 'id' | 'savedAt'>
  ) => {
    // Save locally first (this also creates an auto-saved routine)
    await storage.savePlanConfig(config)

    // Queue cloud sync for 'latest'
    if (isAuthenticated && userId) {
      const fullConfig: SavedPlanConfig = {
        ...config,
        id: 'latest',
        savedAt: new Date().toISOString(),
      }
      queueSync('planConfig-latest', () =>
        syncPlanConfig(fullConfig, userId).then(() => {})
      )

      // Also sync the auto-saved routine that was just created
      // Get the most recent routine to sync it
      const routines = await storage.getAllSavedRoutines()
      const mostRecent = routines.find(r => r.isAutoSaved)
      if (mostRecent) {
        queueSync(`routine-${mostRecent.id}`, () =>
          syncPlanConfig(mostRecent, userId).then(() => {})
        )
      }
    }
  }, [storage.savePlanConfig, storage.getAllSavedRoutines, isAuthenticated, userId, queueSync])

  // Sync-aware save named routine
  const saveNamedRoutineWithSync = useCallback(async (
    config: Omit<SavedPlanConfig, 'id' | 'savedAt'>,
    name: string
  ): Promise<string> => {
    // Save locally first
    const routineId = await storage.saveNamedRoutine(config, name)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const fullConfig: SavedPlanConfig = {
        ...config,
        id: routineId,
        name,
        isAutoSaved: false,
        savedAt: new Date().toISOString(),
      }
      queueSync(`routine-${routineId}`, () =>
        syncPlanConfig(fullConfig, userId).then(() => {})
      )
    }

    return routineId
  }, [storage.saveNamedRoutine, isAuthenticated, userId, queueSync])

  // Sync-aware rename routine
  const renameRoutineWithSync = useCallback(async (id: string, newName: string) => {
    // Rename locally first
    await storage.renameRoutine(id, newName)

    // Queue cloud sync - fetch the updated routine and sync it
    if (isAuthenticated && userId) {
      const routine = await storage.getRoutineById(id)
      if (routine) {
        queueSync(`routine-${id}`, () =>
          syncPlanConfig(routine, userId).then(() => {})
        )
      }
    }
  }, [storage.renameRoutine, storage.getRoutineById, isAuthenticated, userId, queueSync])

  // Sync-aware toggle routine star
  const toggleRoutineStarWithSync = useCallback(async (id: string): Promise<boolean> => {
    // Toggle locally first
    const newStarred = await storage.toggleRoutineStar(id)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const routine = await storage.getRoutineById(id)
      if (routine) {
        queueSync(`routine-${id}`, () =>
          syncPlanConfig(routine, userId).then(() => {})
        )
      }
    }

    return newStarred
  }, [storage.toggleRoutineStar, storage.getRoutineById, isAuthenticated, userId, queueSync])

  // Sync-aware delete routine
  const deleteRoutineWithSync = useCallback(async (id: string) => {
    // Delete locally first
    await storage.deleteRoutine(id)

    // Queue cloud deletion
    if (isAuthenticated && userId) {
      queueSync(`delete-routine-${id}`, () =>
        deleteRoutineFromCloud(id, userId).then(() => {})
      )
    }
  }, [storage.deleteRoutine, isAuthenticated, userId, queueSync])

  // Sync reminders to cloud after local sync
  const syncRemindersWithCloud = useCallback(async (reminders: Reminder[]) => {
    console.log('[useSync] syncRemindersWithCloud called with:', {
      remindersCount: reminders.length,
      isAuthenticated,
      userId: userId ? userId.substring(0, 8) + '...' : null,
    })

    if (!isAuthenticated || !userId) {
      console.log('[useSync] Skipping reminders cloud sync - not authenticated')
      return
    }

    console.log('[useSync] Syncing', reminders.length, 'reminders to cloud')
    queueSync('reminders-batch', () =>
      syncRemindersToCloud(reminders, userId).then(() => {
        console.log('[useSync] syncRemindersToCloud completed')
      })
    )
  }, [isAuthenticated, userId, queueSync])

  // Toggle reminder completion with cloud sync
  const toggleReminderCompletionWithSync = useCallback(async (reminderId: string): Promise<boolean> => {
    // Toggle locally first
    const newCompletionState = toggleReminderCompletionLocal(reminderId)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      queueSync(`reminder-${reminderId}`, () =>
        updateReminderCompletionInCloud(reminderId, newCompletionState, newCompletionState, userId).then(() => {})
      )
    }

    return newCompletionState
  }, [isAuthenticated, userId, queueSync])

  // Sync-aware save mood entry
  const saveMoodEntryWithSync = useCallback(async (entry: {
    date: string
    category: string
    emotion?: string
    notes?: string
  }) => {
    // Save locally first
    await storage.saveMoodEntry(entry)

    // Queue cloud sync
    if (isAuthenticated && userId) {
      const savedAt = new Date().toISOString()
      queueSync(`mood-${entry.date}`, () =>
        syncMoodEntry({ ...entry, savedAt }, userId).then(() => {})
      )
    }
  }, [storage.saveMoodEntry, isAuthenticated, userId, queueSync])

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
        // Merge completions - cloud data overwrites local for same IDs (instance-based)
        // Preserve all fields including durationMinutes and Strava metadata
        for (const completion of cloudData.completions) {
          const { id, completedAt, ...saveData } = completion
          await storage.saveCompletion({
            ...saveData,
            instanceIndex: saveData.instanceIndex ?? 0,  // Default to 0 for legacy
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

        // Merge plan configs and routines from cloud
        if (cloudData.planConfigs.length > 0) {
          // Save 'latest' plan config
          const latestConfig = cloudData.planConfigs.find(c => c.id === 'latest')
          if (latestConfig) {
            await storage.savePlanConfig({
              selectedActivities: latestConfig.selectedActivities,
              frequencies: latestConfig.frequencies,
              customDays: latestConfig.customDays,
              heavyDaySchedule: latestConfig.heavyDaySchedule,
              lightDaySchedule: latestConfig.lightDaySchedule,
              startWithHeavy: latestConfig.startWithHeavy,
            })
          }

          // Save all other routines (named/starred/auto-saved)
          const routines = cloudData.planConfigs.filter(c => c.id !== 'latest')
          for (const routine of routines) {
            await storage.saveRoutine(routine)
          }
          console.log('[useSync] Merged', routines.length, 'routines from cloud')
        }

        // Merge reminders from cloud
        if (cloudData.reminders && cloudData.reminders.length > 0) {
          const localReminders = getStoredReminders()
          const localRemindersMap = new Map(localReminders.map(r => [r.id, r]))

          // Also build a dedup key map (title + normalized date) to catch duplicates
          // where the raw ID format differs between shortcut runs
          const getDedupeKey = (r: { title: string; dueDate: Date }) => {
            const t = r.title.toLowerCase().trim()
            const d = r.dueDate
            return `${t}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}`
          }
          const localByKey = new Map(localReminders.map(r => [getDedupeKey(r), r]))

          // Merge cloud reminders with local, preserving local completedInApp if set
          const mergedReminders: Reminder[] = []
          const seenKeys = new Set<string>()

          for (const cloudReminder of cloudData.reminders) {
            const key = getDedupeKey(cloudReminder)
            if (seenKeys.has(key)) continue
            seenKeys.add(key)

            // Find local match by ID or dedup key
            const localReminder = localRemindersMap.get(cloudReminder.id) || localByKey.get(key)

            if (localReminder) {
              // Merge: prefer cloud completion status unless completed in app locally
              const merged: Reminder = {
                ...cloudReminder,
                completedInApp: localReminder.completedInApp || cloudReminder.completedInApp,
                isCompleted: localReminder.completedInApp
                  ? true
                  : cloudReminder.isCompleted,
              }
              mergedReminders.push(merged)
              localRemindersMap.delete(localReminder.id)
              localRemindersMap.delete(cloudReminder.id)
              localByKey.delete(key)
            } else {
              mergedReminders.push(cloudReminder)
            }
          }

          // Add any local-only reminders (not in cloud yet), deduplicating
          for (const localReminder of localRemindersMap.values()) {
            const key = getDedupeKey(localReminder)
            if (!seenKeys.has(key)) {
              mergedReminders.push(localReminder)
              seenKeys.add(key)
            }
          }

          // Sort by due date and save
          mergedReminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
          saveReminders(mergedReminders)
          console.log('[useSync] Merged', cloudData.reminders.length, 'reminders from cloud')
        }

        // Merge mood entries from cloud
        if (cloudData.moodEntries && cloudData.moodEntries.length > 0) {
          for (const moodEntry of cloudData.moodEntries) {
            await storage.saveMoodEntry({
              date: moodEntry.date,
              category: moodEntry.category,
              emotion: moodEntry.emotion,
              notes: moodEntry.notes,
            })
          }
          console.log('[useSync] Merged', cloudData.moodEntries.length, 'mood entries from cloud')
        }

        console.log('[useSync] Pulled data from cloud:', {
          completions: cloudData.completions.length,
          schedules: cloudData.schedules.length,
          planConfigs: cloudData.planConfigs.length,
          reminders: cloudData.reminders?.length || 0,
          moodEntries: cloudData.moodEntries?.length || 0,
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
      const reminders = getStoredReminders()

      const result = await pushAllToCloud(userId, {
        completions,
        schedules,
        planConfig,
        reminders,
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

    // Override routine operations with sync versions
    saveNamedRoutine: saveNamedRoutineWithSync,
    renameRoutine: renameRoutineWithSync,
    toggleRoutineStar: toggleRoutineStarWithSync,
    deleteRoutine: deleteRoutineWithSync,

    // Override mood entry with sync version
    saveMoodEntry: saveMoodEntryWithSync,

    // Sync actions
    pullFromCloud,
    migrateToCloud,
    dismissMigration,

    // Reminder sync operations
    syncRemindersWithCloud,
    toggleReminderCompletion: toggleReminderCompletionWithSync,
  }
}
