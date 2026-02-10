'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Building Nick - IndexedDB Storage Hook
 * With timeout fallback for hanging callbacks
 */

const DB_NAME = 'BuildingNickDB'
const DB_VERSION = 6  // v6: Added audioCache store for TTS audio caching
const OPERATION_TIMEOUT = 5000 // 5 seconds

export interface Completion {
  id: string  // Format: `${date}_${activityId}_${timeBlock}_${instanceIndex}`
  date: string
  activityId: string
  timeBlock: string
  instanceIndex: number  // Position in the time block array (0-based)
  completedAt: string
  durationMinutes?: number  // User-overridden duration (falls back to activity default)
  // Strava import metadata (optional)
  stravaActivityName?: string   // e.g. "Wahoo SYSTM: On Location - Provence"
  stravaDistance?: number        // Distance in meters
  stravaSportType?: string       // e.g. "Ride", "Run", "Walk"
  stravaCalories?: number        // Kilojoules (Strava returns as kilojoules for rides)
  stravaAvgHeartrate?: number    // Average heart rate in bpm
  stravaStartTime?: string       // ISO timestamp from start_date_local (e.g. "2026-02-07T14:30:00")
  stravaElapsedSeconds?: number  // Total elapsed time in seconds (start to finish)
}

export interface DailySchedule {
  date: string
  activities: {
    before6am: string[]
    before9am: string[]
    beforeNoon: string[]
    before230pm: string[]
    before5pm: string[]
    before9pm: string[]
  }
}

export interface WeekPlan {
  weekStart: string
  mindBodyFocus: string[]
  physicalSchedule: Record<string, string[]>
  createdAt: string
}

export type TimeBlock = 'before6am' | 'before9am' | 'beforeNoon' | 'before230pm' | 'before5pm' | 'before9pm'

export interface SavedPlanConfig {
  id: string  // 'latest' or a unique id (uuid for named routines)
  savedAt: string
  name?: string  // Optional name for saved routines (undefined for 'latest')
  starred?: boolean  // Whether the routine is starred/favorited
  isAutoSaved?: boolean  // True for auto-saved routines (recent history)
  selectedActivities: string[]  // Activity IDs
  frequencies: Record<string, 'everyday' | 'heavy' | 'light' | 'weekdays' | 'weekends' | 'custom'>
  customDays: Record<string, string[]>  // Activity ID -> array of ISO date strings for custom frequency
  heavyDaySchedule: DailySchedule['activities']
  lightDaySchedule: DailySchedule['activities']
  startWithHeavy: boolean
}

// TTS Audio Cache entry
export interface CachedAudio {
  id: string       // Hash of text + voice for regular TTS, or activityId_lessonId for Claude-generated
  text: string     // Original text (for debugging/verification)
  voice: string    // Voice used (e.g., 'rachel' for OpenAI)
  audioBlob: Blob  // The cached audio file
  createdAt: string
  type: 'tts' | 'claude_generated'  // Regular TTS or Claude-generated script
  activityId?: string  // For Claude-generated audio, the activity ID
  lessonId?: string    // For Claude-generated audio, the lesson ID
}

// Single shared promise for database connection
let dbPromise: Promise<IDBDatabase> | null = null
let currentDb: IDBDatabase | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    console.log('getDB: returning existing promise')
    return dbPromise
  }

  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    console.log('Opening IndexedDB v' + DB_VERSION + '...')

    let resolved = false

    // Timeout after 5 seconds
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.error('IndexedDB open timed out after 5s')
        dbPromise = null
        resolved = true
        reject(new Error('IndexedDB open timed out'))
      }
    }, 5000)

    // Close any existing connection first
    if (currentDb) {
      console.log('Closing existing connection...')
      currentDb.close()
      currentDb = null
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)
      console.error('IndexedDB open error:', request.error)
      dbPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)
      console.log('IndexedDB opened successfully, version:', request.result.version)
      const db = request.result
      currentDb = db

      // Verify all stores exist
      const requiredStores = ['completions', 'schedules', 'weekPlans', 'activities', 'metadata', 'savedPlanConfigs', 'audioCache']
      const missingStores = requiredStores.filter(s => !db.objectStoreNames.contains(s))
      if (missingStores.length > 0) {
        console.warn('Missing stores after open:', missingStores)
        // Force a re-upgrade by deleting and recreating
        db.close()
        currentDb = null
        dbPromise = null
        console.log('Deleting database to force upgrade...')
        const deleteReq = indexedDB.deleteDatabase(DB_NAME)
        deleteReq.onsuccess = () => {
          console.log('Database deleted, retrying...')
          // Retry after delete
          resolve(getDB() as unknown as IDBDatabase)
        }
        deleteReq.onerror = () => reject(new Error('Failed to delete database'))
        return
      }

      db.onclose = () => {
        console.log('IndexedDB connection closed')
        dbPromise = null
        currentDb = null
      }

      db.onversionchange = () => {
        console.log('Version change detected, closing')
        db.close()
        dbPromise = null
        currentDb = null
      }

      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      console.log('IndexedDB upgrade needed from', event.oldVersion, 'to', event.newVersion)
      const database = (event.target as IDBOpenDBRequest).result
      const transaction = (event.target as IDBOpenDBRequest).transaction

      // v5: Remove old unique dateActivity index by recreating completions store
      if (event.oldVersion < 5 && database.objectStoreNames.contains('completions')) {
        console.log('Migrating completions store for instance-based tracking...')
        // Read existing completions before deleting
        const existingCompletions: Completion[] = []
        if (transaction) {
          try {
            const oldStore = transaction.objectStore('completions')
            const getAllRequest = oldStore.getAll()
            getAllRequest.onsuccess = () => {
              const oldCompletions = getAllRequest.result || []
              console.log('Found', oldCompletions.length, 'existing completions to migrate')
              // Migrate old completions to new format (add instanceIndex: 0)
              for (const c of oldCompletions) {
                existingCompletions.push({
                  ...c,
                  instanceIndex: c.instanceIndex ?? 0,
                  // Update ID to new format if needed
                  id: c.id.split('_').length === 4 ? c.id : `${c.date}_${c.activityId}_${c.timeBlock || 'before9am'}_0`
                })
              }
            }
          } catch (e) {
            console.warn('Could not read existing completions:', e)
          }
        }

        // Delete old store
        database.deleteObjectStore('completions')
        console.log('Deleted old completions store')

        // Create new store with correct indexes
        const completionsStore = database.createObjectStore('completions', { keyPath: 'id' })
        completionsStore.createIndex('date', 'date', { unique: false })
        completionsStore.createIndex('activityId', 'activityId', { unique: false })
        console.log('Created new completions store with instance-based tracking')

        // Re-add migrated completions
        for (const c of existingCompletions) {
          completionsStore.add(c)
        }
        if (existingCompletions.length > 0) {
          console.log('Migrated', existingCompletions.length, 'completions')
        }
      } else if (!database.objectStoreNames.contains('completions')) {
        console.log('Creating completions store')
        const completionsStore = database.createObjectStore('completions', { keyPath: 'id' })
        completionsStore.createIndex('date', 'date', { unique: false })
        completionsStore.createIndex('activityId', 'activityId', { unique: false })
      }

      if (!database.objectStoreNames.contains('schedules')) {
        console.log('Creating schedules store')
        database.createObjectStore('schedules', { keyPath: 'date' })
      }

      if (!database.objectStoreNames.contains('weekPlans')) {
        console.log('Creating weekPlans store')
        database.createObjectStore('weekPlans', { keyPath: 'weekStart' })
      }

      // Activities cache (v2+)
      if (!database.objectStoreNames.contains('activities')) {
        console.log('Creating activities store')
        database.createObjectStore('activities', { keyPath: 'id' })
      }

      // Activities metadata (sync timestamp) (v2+)
      if (!database.objectStoreNames.contains('metadata')) {
        console.log('Creating metadata store')
        database.createObjectStore('metadata', { keyPath: 'key' })
      }

      // Saved plan configurations (v4+)
      if (!database.objectStoreNames.contains('savedPlanConfigs')) {
        console.log('Creating savedPlanConfigs store')
        database.createObjectStore('savedPlanConfigs', { keyPath: 'id' })
      }

      // Audio cache for TTS (v6+)
      if (!database.objectStoreNames.contains('audioCache')) {
        console.log('Creating audioCache store')
        const audioCacheStore = database.createObjectStore('audioCache', { keyPath: 'id' })
        audioCacheStore.createIndex('activityId', 'activityId', { unique: false })
        audioCacheStore.createIndex('type', 'type', { unique: false })
      }
    }

    request.onblocked = () => {
      console.warn('IndexedDB open blocked by another tab - please close other tabs')
      // Don't reject here - wait for unblock or timeout
    }

    console.log('IndexedDB open request created, waiting for callbacks...')
  })

  return dbPromise
}

// Put with timeout - if callbacks don't fire, verify the write directly
async function dbPut(storeName: string, data: unknown, keyPath: string): Promise<void> {
  const db = await getDB()

  return new Promise<void>((resolve, reject) => {
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout>

    const finish = (success: boolean, error?: Error) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)
      if (success) {
        resolve()
      } else {
        reject(error || new Error('Unknown error'))
      }
    }

    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.put(data)

      request.onsuccess = () => {
        console.log(`Put to ${storeName} succeeded (callback)`)
        finish(true)
      }

      request.onerror = () => {
        console.error(`Put to ${storeName} failed:`, request.error)
        finish(false, request.error || new Error('Put failed'))
      }

      tx.oncomplete = () => {
        console.log(`Transaction to ${storeName} completed`)
        finish(true)
      }

      tx.onerror = () => {
        console.error(`Transaction to ${storeName} error:`, tx.error)
        finish(false, tx.error || new Error('Transaction failed'))
      }

      tx.onabort = () => {
        console.error(`Transaction to ${storeName} aborted`)
        finish(false, new Error('Transaction aborted'))
      }

      // Timeout fallback - check if the data was written
      timeoutId = setTimeout(async () => {
        if (resolved) return

        console.log(`Put to ${storeName} timeout - verifying write...`)

        try {
          // Try to read the data back to verify it was written
          const key = (data as Record<string, unknown>)[keyPath] as string
          const verifyTx = db.transaction(storeName, 'readonly')
          const verifyStore = verifyTx.objectStore(storeName)
          const verifyRequest = verifyStore.get(key)

          verifyRequest.onsuccess = () => {
            if (verifyRequest.result) {
              console.log(`Put to ${storeName} verified via read-back`)
              finish(true)
            } else {
              console.error(`Put to ${storeName} failed - data not found`)
              finish(false, new Error('Data not written'))
            }
          }

          verifyRequest.onerror = () => {
            console.error(`Verification read failed:`, verifyRequest.error)
            finish(false, new Error('Verification failed'))
          }

          // If even the verification doesn't respond, give up
          setTimeout(() => {
            if (!resolved) {
              console.error(`${storeName} operation completely timed out`)
              dbPromise = null // Reset connection
              finish(false, new Error('Complete timeout'))
            }
          }, 2000)

        } catch (e) {
          console.error('Verification error:', e)
          finish(false, e instanceof Error ? e : new Error('Verification error'))
        }
      }, OPERATION_TIMEOUT)

    } catch (e) {
      console.error('Failed to create transaction:', e)
      dbPromise = null
      finish(false, e instanceof Error ? e : new Error('Transaction creation failed'))
    }
  })
}

// Simple get operation with timeout
async function dbGet<T>(storeName: string, key: string): Promise<T | null> {
  const db = await getDB()

  return new Promise<T | null>((resolve, reject) => {
    let resolved = false

    const finish = (result: T | null | undefined, error?: Error) => {
      if (resolved) return
      resolved = true
      if (error) {
        reject(error)
      } else {
        resolve(result ?? null)
      }
    }

    try {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.get(key)

      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish(null, request.error || new Error('Get failed'))

      setTimeout(() => {
        if (!resolved) {
          console.warn(`Get from ${storeName} timed out`)
          finish(null)
        }
      }, OPERATION_TIMEOUT)
    } catch (e) {
      dbPromise = null
      finish(null, e instanceof Error ? e : new Error('Failed'))
    }
  })
}

// Simple delete operation
async function dbDelete(storeName: string, key: string): Promise<void> {
  const db = await getDB()

  return new Promise<void>((resolve, reject) => {
    let resolved = false

    const finish = (error?: Error) => {
      if (resolved) return
      resolved = true
      if (error) reject(error)
      else resolve()
    }

    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const request = store.delete(key)

      request.onsuccess = () => finish()
      request.onerror = () => finish(request.error || new Error('Delete failed'))

      setTimeout(() => {
        if (!resolved) finish() // Assume success on timeout for delete
      }, OPERATION_TIMEOUT)
    } catch (e) {
      dbPromise = null
      finish(e instanceof Error ? e : new Error('Failed'))
    }
  })
}

// Get all from index
async function dbGetAllByIndex<T>(storeName: string, indexName: string, key: string): Promise<T[]> {
  const db = await getDB()

  return new Promise<T[]>((resolve, reject) => {
    let resolved = false

    const finish = (result: T[] | undefined, error?: Error) => {
      if (resolved) return
      resolved = true
      if (error) reject(error)
      else resolve(result ?? [])
    }

    try {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const index = store.index(indexName)
      const request = index.getAll(key)

      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish([], request.error || new Error('Query failed'))

      setTimeout(() => {
        if (!resolved) finish([])
      }, OPERATION_TIMEOUT)
    } catch (e) {
      dbPromise = null
      finish([], e instanceof Error ? e : new Error('Failed'))
    }
  })
}

// Get all from store
async function dbGetAll<T>(storeName: string): Promise<T[]> {
  const db = await getDB()

  return new Promise<T[]>((resolve, reject) => {
    let resolved = false

    const finish = (result: T[] | undefined, error?: Error) => {
      if (resolved) return
      resolved = true
      if (error) reject(error)
      else resolve(result ?? [])
    }

    try {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const request = store.getAll()

      request.onsuccess = () => finish(request.result)
      request.onerror = () => finish([], request.error || new Error('GetAll failed'))

      setTimeout(() => {
        if (!resolved) finish([])
      }, OPERATION_TIMEOUT)
    } catch (e) {
      dbPromise = null
      finish([], e instanceof Error ? e : new Error('Failed'))
    }
  })
}

// Delete database
async function deleteDatabase(): Promise<void> {
  dbPromise = null

  return new Promise((resolve, reject) => {
    console.log('Deleting database...')
    const request = indexedDB.deleteDatabase(DB_NAME)

    request.onsuccess = () => {
      console.log('Database deleted')
      resolve()
    }
    request.onerror = () => {
      console.error('Delete failed:', request.error)
      reject(request.error)
    }
    request.onblocked = () => {
      console.warn('Delete blocked')
      setTimeout(resolve, 100)
    }

    // Force resolve after timeout
    setTimeout(resolve, 3000)
  })
}

export function useStorage() {
  const [isReady, setIsReady] = useState(false)
  const [hasConnectionError, setHasConnectionError] = useState(false)

  useEffect(() => {
    console.log('useStorage useEffect running, window:', typeof window)
    if (typeof window === 'undefined') return

    console.log('useStorage: calling getDB()...')
    getDB()
      .then(() => {
        console.log('useStorage: getDB() resolved, setting isReady=true')
        setIsReady(true)
        setHasConnectionError(false)
      })
      .catch((err) => {
        console.error('Failed to open IndexedDB:', err)
        setHasConnectionError(true)
        setIsReady(true)
      })
  }, [])

  // Completions
  // Instance-based: each instance of an activity (by position in time block) has its own completion
  const saveCompletion = useCallback(async (completion: Omit<Completion, 'id' | 'completedAt'>) => {
    const fullCompletion: Completion = {
      ...completion,
      id: `${completion.date}_${completion.activityId}_${completion.timeBlock}_${completion.instanceIndex}`,
      completedAt: new Date().toISOString(),
    }
    await dbPut('completions', fullCompletion, 'id')
  }, [])

  const removeCompletion = useCallback(async (date: string, activityId: string, timeBlock: string, instanceIndex: number) => {
    await dbDelete('completions', `${date}_${activityId}_${timeBlock}_${instanceIndex}`)
  }, [])

  const updateCompletionDuration = useCallback(async (date: string, activityId: string, timeBlock: string, instanceIndex: number, durationMinutes: number) => {
    const id = `${date}_${activityId}_${timeBlock}_${instanceIndex}`
    const existing = await dbGet<Completion>('completions', id)
    if (existing) {
      await dbPut('completions', { ...existing, durationMinutes }, 'id')
    }
  }, [])

  const getCompletionsForDate = useCallback(async (date: string): Promise<Completion[]> => {
    return dbGetAllByIndex<Completion>('completions', 'date', date)
  }, [])

  // Check if a specific instance is completed
  const isActivityInstanceCompleted = useCallback(async (
    date: string,
    activityId: string,
    timeBlock: string,
    instanceIndex: number
  ): Promise<boolean> => {
    const id = `${date}_${activityId}_${timeBlock}_${instanceIndex}`
    const result = await dbGet<Completion>('completions', id)
    return !!result
  }, [])

  // Schedules
  const saveDailySchedule = useCallback(async (schedule: DailySchedule): Promise<void> => {
    console.log('Saving schedule for:', schedule.date)
    await dbPut('schedules', schedule, 'date')
    console.log('Schedule saved:', schedule.date)
  }, [])

  const getDailySchedule = useCallback(async (date: string): Promise<DailySchedule | null> => {
    return dbGet<DailySchedule>('schedules', date)
  }, [])

  // Week Plans
  const saveWeekPlan = useCallback(async (plan: WeekPlan) => {
    await dbPut('weekPlans', plan, 'weekStart')
  }, [])

  const getWeekPlan = useCallback(async (weekStart: string): Promise<WeekPlan | null> => {
    return dbGet<WeekPlan>('weekPlans', weekStart)
  }, [])

  // Stats
  const getCurrentStreak = useCallback(async (): Promise<number> => {
    const completions = await dbGetAll<Completion>('completions')
    const dates = [...new Set(completions.map(c => c.date))].sort().reverse()

    let streak = 0
    const today = new Date()

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const dateStr = checkDate.toISOString().split('T')[0]

      if (dates.includes(dateStr)) {
        streak++
      } else if (i > 0) {
        break
      }
    }

    return streak
  }, [])

  const getCompletionStats = useCallback(async (days: number): Promise<{ total: number; daysWithActivity: number }> => {
    const completions = await dbGetAll<Completion>('completions')
    const today = new Date()
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - days)

    const recentCompletions = completions.filter(c => new Date(c.date) >= cutoff)
    const uniqueDays = new Set(recentCompletions.map(c => c.date))

    return {
      total: recentCompletions.length,
      daysWithActivity: uniqueDays.size
    }
  }, [])

  // Activities cache - batch save for better performance
  const saveActivities = useCallback(async (activities: Record<string, unknown>): Promise<void> => {
    const db = await getDB()

    return new Promise<void>((resolve, reject) => {
      let resolved = false

      const finish = (success: boolean, error?: Error) => {
        if (resolved) return
        resolved = true
        if (success) resolve()
        else reject(error || new Error('Save activities failed'))
      }

      try {
        // Use a single transaction for all activities
        const tx = db.transaction(['activities', 'metadata'], 'readwrite')
        const activitiesStore = tx.objectStore('activities')
        const metadataStore = tx.objectStore('metadata')

        // Save all activities in the same transaction
        for (const [id, activity] of Object.entries(activities)) {
          activitiesStore.put({ ...(activity as object), id })
        }

        // Save sync timestamp
        metadataStore.put({ key: 'activitiesSyncTime', value: new Date().toISOString() })

        tx.oncomplete = () => {
          console.log(`Saved ${Object.keys(activities).length} activities in batch`)
          finish(true)
        }

        tx.onerror = () => {
          console.error('Batch save failed:', tx.error)
          finish(false, tx.error || new Error('Transaction failed'))
        }

        tx.onabort = () => {
          console.error('Batch save aborted')
          finish(false, new Error('Transaction aborted'))
        }

        // Timeout fallback
        setTimeout(() => {
          if (!resolved) {
            console.error('Batch save timed out')
            finish(false, new Error('Save activities timed out'))
          }
        }, 15000) // 15 second timeout for batch

      } catch (e) {
        console.error('Failed to create batch transaction:', e)
        finish(false, e instanceof Error ? e : new Error('Transaction creation failed'))
      }
    })
  }, [])

  const getCachedActivities = useCallback(async (): Promise<Record<string, unknown>> => {
    const activities = await dbGetAll<{ id: string } & Record<string, unknown>>('activities')
    const result: Record<string, unknown> = {}
    for (const activity of activities) {
      result[activity.id] = activity
    }
    return result
  }, [])

  const getActivitiesSyncTime = useCallback(async (): Promise<string | null> => {
    const meta = await dbGet<{ key: string; value: string }>('metadata', 'activitiesSyncTime')
    return meta?.value || null
  }, [])

  // Saved Plan Configs
  // Also auto-saves to recent routines (keeps last 5)
  const savePlanConfig = useCallback(async (config: Omit<SavedPlanConfig, 'id' | 'savedAt'>): Promise<void> => {
    const now = new Date()
    const timestamp = now.toISOString()

    // Save as 'latest'
    const fullConfig: SavedPlanConfig = {
      ...config,
      id: 'latest',
      savedAt: timestamp
    }
    await dbPut('savedPlanConfigs', fullConfig, 'id')

    // Also auto-save to recent routines with timestamp name
    const autoSaveId = `auto_${now.getTime()}`
    const autoSaveName = now.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
    const autoSaveConfig: SavedPlanConfig = {
      ...config,
      id: autoSaveId,
      name: autoSaveName,
      savedAt: timestamp,
      isAutoSaved: true
    }
    await dbPut('savedPlanConfigs', autoSaveConfig, 'id')

    // Clean up old auto-saves, keep only last 5
    const all = await dbGetAll<SavedPlanConfig>('savedPlanConfigs')
    const autoSaves = all
      .filter(c => c.isAutoSaved)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())

    // Delete auto-saves beyond the 5th
    for (let i = 5; i < autoSaves.length; i++) {
      await dbDelete('savedPlanConfigs', autoSaves[i].id)
    }
  }, [])

  const getLastPlanConfig = useCallback(async (): Promise<SavedPlanConfig | null> => {
    return dbGet<SavedPlanConfig>('savedPlanConfigs', 'latest')
  }, [])

  // Named Routines (saved plan configs with a name)
  // When saving a named routine, delete the most recent auto-save if created within 60 seconds
  // This prevents duplicates when user saves with a name right after planning
  const saveNamedRoutine = useCallback(async (
    config: Omit<SavedPlanConfig, 'id' | 'savedAt'>,
    name: string
  ): Promise<string> => {
    const now = new Date()
    const id = `routine_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`
    const fullConfig: SavedPlanConfig = {
      ...config,
      id,
      name,
      isAutoSaved: false,
      savedAt: now.toISOString()
    }
    await dbPut('savedPlanConfigs', fullConfig, 'id')

    // Find and delete recent auto-saves (created within 60 seconds)
    const all = await dbGetAll<SavedPlanConfig>('savedPlanConfigs')
    const recentAutoSaves = all.filter(c => {
      if (!c.isAutoSaved || c.id === 'latest') return false
      const savedTime = new Date(c.savedAt).getTime()
      const timeDiff = now.getTime() - savedTime
      return timeDiff < 60000 // Within 60 seconds
    })

    // Delete recent auto-saves to avoid duplicates
    for (const autoSave of recentAutoSaves) {
      await dbDelete('savedPlanConfigs', autoSave.id)
    }

    return id
  }, [])

  const getAllSavedRoutines = useCallback(async (): Promise<SavedPlanConfig[]> => {
    const all = await dbGetAll<SavedPlanConfig>('savedPlanConfigs')
    // Return all configs except 'latest', sorted by starred first, then savedAt descending
    return all
      .filter(c => c.id !== 'latest')
      .sort((a, b) => {
        // Starred first
        if (a.starred && !b.starred) return -1
        if (!a.starred && b.starred) return 1
        // Then by date
        return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
      })
  }, [])

  // Get most recent routine (for default loading in planner)
  const getMostRecentRoutine = useCallback(async (): Promise<SavedPlanConfig | null> => {
    const all = await dbGetAll<SavedPlanConfig>('savedPlanConfigs')
    const routines = all
      .filter(c => c.id !== 'latest')
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    return routines[0] || null
  }, [])

  const getRoutineById = useCallback(async (id: string): Promise<SavedPlanConfig | null> => {
    return dbGet<SavedPlanConfig>('savedPlanConfigs', id)
  }, [])

  const deleteRoutine = useCallback(async (id: string): Promise<void> => {
    if (id === 'latest') return  // Don't allow deleting 'latest'
    await dbDelete('savedPlanConfigs', id)
  }, [])

  const renameRoutine = useCallback(async (id: string, newName: string): Promise<void> => {
    if (id === 'latest') return
    const existing = await dbGet<SavedPlanConfig>('savedPlanConfigs', id)
    if (existing) {
      existing.name = newName
      // When renaming, mark as not auto-saved (user is intentionally saving)
      existing.isAutoSaved = false
      await dbPut('savedPlanConfigs', existing, 'id')
    }
  }, [])

  const toggleRoutineStar = useCallback(async (id: string): Promise<boolean> => {
    if (id === 'latest') return false
    const existing = await dbGet<SavedPlanConfig>('savedPlanConfigs', id)
    if (existing) {
      existing.starred = !existing.starred
      // Starring a routine marks it as not auto-saved (user wants to keep it)
      if (existing.starred) {
        existing.isAutoSaved = false
      }
      await dbPut('savedPlanConfigs', existing, 'id')
      return existing.starred
    }
    return false
  }, [])

  // Promote an auto-saved routine to a named routine
  const promoteRoutine = useCallback(async (id: string, name: string): Promise<void> => {
    if (id === 'latest') return
    const existing = await dbGet<SavedPlanConfig>('savedPlanConfigs', id)
    if (existing) {
      existing.name = name
      existing.isAutoSaved = false
      await dbPut('savedPlanConfigs', existing, 'id')
    }
  }, [])

  // Save a complete routine (used for cloud sync)
  const saveRoutine = useCallback(async (routine: SavedPlanConfig): Promise<void> => {
    await dbPut('savedPlanConfigs', routine, 'id')
  }, [])

  // Check if there are scheduled activities in the next N days
  const getScheduledActivitiesForRange = useCallback(async (startDate: string, days: number): Promise<Record<string, string[]>> => {
    const result: Record<string, string[]> = {}
    const start = new Date(startDate)

    for (let i = 0; i < days; i++) {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      const schedule = await getDailySchedule(dateStr)
      if (schedule) {
        // Collect all activities from all time blocks
        const allActivities: string[] = []
        for (const block of Object.values(schedule.activities)) {
          allActivities.push(...block)
        }
        if (allActivities.length > 0) {
          result[dateStr] = allActivities
        }
      }
    }

    return result
  }, [getDailySchedule])

  // Audio Cache
  // Generate a cache key from text and voice
  const generateAudioCacheKey = useCallback((text: string, voice: string): string => {
    // Simple hash function for cache key
    const str = `${text}_${voice}`
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return `tts_${Math.abs(hash).toString(36)}`
  }, [])

  const getCachedAudio = useCallback(async (text: string, voice: string): Promise<Blob | null> => {
    const id = generateAudioCacheKey(text, voice)
    const cached = await dbGet<CachedAudio>('audioCache', id)
    if (cached?.audioBlob) {
      console.log('Audio cache hit for:', text.substring(0, 50) + '...')
      return cached.audioBlob
    }
    return null
  }, [generateAudioCacheKey])

  const saveAudioToCache = useCallback(async (text: string, voice: string, audioBlob: Blob): Promise<void> => {
    const id = generateAudioCacheKey(text, voice)
    const entry: CachedAudio = {
      id,
      text,
      voice,
      audioBlob,
      createdAt: new Date().toISOString(),
      type: 'tts'
    }
    await dbPut('audioCache', entry, 'id')
    console.log('Audio cached for:', text.substring(0, 50) + '...')
  }, [generateAudioCacheKey])

  // Claude-generated audio (for activities with custom prompts)
  const getClaudeGeneratedAudio = useCallback(async (activityId: string, lessonId: string): Promise<Blob | null> => {
    const id = `claude_${activityId}_${lessonId}`
    const cached = await dbGet<CachedAudio>('audioCache', id)
    if (cached?.audioBlob) {
      console.log('Claude audio cache hit for:', activityId, lessonId)
      return cached.audioBlob
    }
    return null
  }, [])

  const saveClaudeGeneratedAudio = useCallback(async (
    activityId: string,
    lessonId: string,
    text: string,
    audioBlob: Blob
  ): Promise<void> => {
    const id = `claude_${activityId}_${lessonId}`
    const entry: CachedAudio = {
      id,
      text,
      voice: 'claude_generated',
      audioBlob,
      createdAt: new Date().toISOString(),
      type: 'claude_generated',
      activityId,
      lessonId
    }
    await dbPut('audioCache', entry, 'id')
    console.log('Claude audio cached for:', activityId, lessonId)
  }, [])

  const deleteClaudeGeneratedAudio = useCallback(async (activityId: string, lessonId: string): Promise<void> => {
    const id = `claude_${activityId}_${lessonId}`
    await dbDelete('audioCache', id)
    console.log('Claude audio deleted for:', activityId, lessonId)
  }, [])

  // Clear all audio cache (useful for debugging or freeing space)
  const clearAudioCache = useCallback(async (): Promise<void> => {
    const all = await dbGetAll<CachedAudio>('audioCache')
    for (const entry of all) {
      await dbDelete('audioCache', entry.id)
    }
    console.log('Audio cache cleared')
  }, [])

  // Recovery utilities
  const clearDatabase = useCallback(async () => {
    await deleteDatabase()
    setHasConnectionError(false)
    getDB().catch(() => {})
  }, [])

  // Mood check-in storage (uses metadata store with key convention mood_${date})
  const saveMoodEntry = useCallback(async (entry: {
    date: string
    category: string      // e.g. 'energized', 'calm', 'stressed', 'down', 'meh'
    emotion?: string      // e.g. 'hopeful', 'anxious', 'exhausted'
    notes?: string        // free-text notes
  }) => {
    await dbPut('metadata', {
      key: `mood_${entry.date}`,
      ...entry,
      savedAt: new Date().toISOString()
    }, 'key')
  }, [])

  const getMoodEntry = useCallback(async (date: string) => {
    return dbGet<{ key: string; date: string; category: string; emotion?: string; notes?: string; savedAt: string }>('metadata', `mood_${date}`)
  }, [])

  const getMoodEntriesForRange = useCallback(async (startDate: string, endDate: string) => {
    // Scan metadata for mood entries in date range
    const allMetadata = await dbGetAll<{ key: string; date: string; category: string; emotion?: string; notes?: string; savedAt: string }>('metadata')
    return allMetadata.filter(m =>
      m.key?.startsWith('mood_') && m.date >= startDate && m.date <= endDate
    )
  }, [])

  // Weekly goals storage (uses metadata store with key 'weekly_goals')
  const saveWeeklyGoals = useCallback(async (goals: { heart: number; mind: number; body: number; learn: number }) => {
    await dbPut('metadata', {
      key: 'weekly_goals',
      ...goals,
      updatedAt: new Date().toISOString()
    }, 'key')
  }, [])

  const getWeeklyGoals = useCallback(async (): Promise<{ heart: number; mind: number; body: number; learn: number } | null> => {
    const result = await dbGet<{ key: string; heart: number; mind: number; body: number; learn: number }>('metadata', 'weekly_goals')
    if (!result) return null
    return { heart: result.heart, mind: result.mind, body: result.body, learn: result.learn }
  }, [])

  const clearWeeklyGoals = useCallback(async () => {
    const db = await getDB()
    const tx = db.transaction('metadata', 'readwrite')
    const store = tx.objectStore('metadata')
    try {
      store.delete('weekly_goals')
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } catch {
      // Key might not exist, that's fine
    }
  }, [])

  const retryConnection = useCallback(() => {
    dbPromise = null
    setHasConnectionError(false)
    setIsReady(false)

    getDB()
      .then(() => {
        setIsReady(true)
        setHasConnectionError(false)
      })
      .catch(() => {
        setHasConnectionError(true)
        setIsReady(true)
      })
  }, [])

  return {
    isReady,
    hasConnectionError,
    saveCompletion,
    removeCompletion,
    updateCompletionDuration,
    getCompletionsForDate,
    isActivityInstanceCompleted,
    saveDailySchedule,
    getDailySchedule,
    saveWeekPlan,
    getWeekPlan,
    getCurrentStreak,
    getCompletionStats,
    // Activities cache
    saveActivities,
    getCachedActivities,
    getActivitiesSyncTime,
    // Plan configs
    savePlanConfig,
    getLastPlanConfig,
    // Named routines
    saveNamedRoutine,
    saveRoutine,
    getAllSavedRoutines,
    getMostRecentRoutine,
    getRoutineById,
    deleteRoutine,
    renameRoutine,
    toggleRoutineStar,
    promoteRoutine,
    getScheduledActivitiesForRange,
    // Audio cache
    getCachedAudio,
    saveAudioToCache,
    getClaudeGeneratedAudio,
    saveClaudeGeneratedAudio,
    deleteClaudeGeneratedAudio,
    clearAudioCache,
    // Mood tracking
    saveMoodEntry,
    getMoodEntry,
    getMoodEntriesForRange,
    // Weekly goals
    saveWeeklyGoals,
    getWeeklyGoals,
    clearWeeklyGoals,
    // Recovery
    clearDatabase,
    retryConnection
  }
}
