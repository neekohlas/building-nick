'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Building Nick - IndexedDB Storage Hook
 * With timeout fallback for hanging callbacks
 */

const DB_NAME = 'BuildingNickDB'
const DB_VERSION = 3  // Bumped for activities store + new time blocks
const OPERATION_TIMEOUT = 5000 // 5 seconds

export interface Completion {
  id: string
  date: string
  activityId: string
  timeBlock: string
  completedAt: string
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

// Single shared promise for database connection
let dbPromise: Promise<IDBDatabase> | null = null
let currentDb: IDBDatabase | null = null

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'))
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    console.log('Opening IndexedDB v' + DB_VERSION + '...')

    // Close any existing connection first
    if (currentDb) {
      console.log('Closing existing connection...')
      currentDb.close()
      currentDb = null
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error)
      dbPromise = null
      reject(request.error)
    }

    request.onsuccess = () => {
      console.log('IndexedDB opened successfully, version:', request.result.version)
      const db = request.result
      currentDb = db

      // Verify all stores exist
      const requiredStores = ['completions', 'schedules', 'weekPlans', 'activities', 'metadata']
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

      if (!database.objectStoreNames.contains('completions')) {
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
    }

    request.onblocked = () => {
      console.warn('IndexedDB open blocked by another tab - please close other tabs')
    }
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
    if (typeof window === 'undefined') return

    getDB()
      .then(() => {
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
  const saveCompletion = useCallback(async (completion: Omit<Completion, 'id' | 'completedAt'>) => {
    const fullCompletion: Completion = {
      ...completion,
      id: `${completion.date}_${completion.activityId}`,
      completedAt: new Date().toISOString()
    }
    await dbPut('completions', fullCompletion, 'id')
  }, [])

  const removeCompletion = useCallback(async (date: string, activityId: string) => {
    await dbDelete('completions', `${date}_${activityId}`)
  }, [])

  const getCompletionsForDate = useCallback(async (date: string): Promise<Completion[]> => {
    return dbGetAllByIndex<Completion>('completions', 'date', date)
  }, [])

  const isActivityCompleted = useCallback(async (date: string, activityId: string): Promise<boolean> => {
    const result = await dbGet<Completion>('completions', `${date}_${activityId}`)
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

  // Activities cache
  const saveActivities = useCallback(async (activities: Record<string, unknown>): Promise<void> => {
    // Save each activity individually
    for (const [id, activity] of Object.entries(activities)) {
      await dbPut('activities', { ...(activity as object), id }, 'id')
    }
    // Save sync timestamp
    await dbPut('metadata', { key: 'activitiesSyncTime', value: new Date().toISOString() }, 'key')
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

  // Recovery utilities
  const clearDatabase = useCallback(async () => {
    await deleteDatabase()
    setHasConnectionError(false)
    getDB().catch(() => {})
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
    getCompletionsForDate,
    isActivityCompleted,
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
    clearDatabase,
    retryConnection
  }
}
