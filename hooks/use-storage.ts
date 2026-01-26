'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Building Nick - IndexedDB Storage Hook
 * Handles all local data persistence
 */

const DB_NAME = 'BuildingNickDB'
const DB_VERSION = 1

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
    before9am: string[]
    beforeNoon: string[]
    anytime: string[]
  }
}

export interface WeekPlan {
  weekStart: string
  mindBodyFocus: string[]
  physicalSchedule: Record<string, string[]>
  createdAt: string
}

let db: IDBDatabase | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Completions store
      if (!database.objectStoreNames.contains('completions')) {
        const completionsStore = database.createObjectStore('completions', { keyPath: 'id' })
        completionsStore.createIndex('date', 'date', { unique: false })
        completionsStore.createIndex('activityId', 'activityId', { unique: false })
      }

      // Daily schedules store
      if (!database.objectStoreNames.contains('schedules')) {
        database.createObjectStore('schedules', { keyPath: 'date' })
      }

      // Week plans store
      if (!database.objectStoreNames.contains('weekPlans')) {
        database.createObjectStore('weekPlans', { keyPath: 'weekStart' })
      }
    }
  })
}

export function useStorage() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    openDB()
      .then(() => setIsReady(true))
      .catch(console.error)
  }, [])

  // Completions
  const saveCompletion = useCallback(async (completion: Omit<Completion, 'id' | 'completedAt'>) => {
    const database = await openDB()
    const tx = database.transaction('completions', 'readwrite')
    const store = tx.objectStore('completions')

    const fullCompletion: Completion = {
      ...completion,
      id: `${completion.date}_${completion.activityId}`,
      completedAt: new Date().toISOString()
    }

    return new Promise<void>((resolve, reject) => {
      const request = store.put(fullCompletion)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }, [])

  const removeCompletion = useCallback(async (date: string, activityId: string) => {
    const database = await openDB()
    const tx = database.transaction('completions', 'readwrite')
    const store = tx.objectStore('completions')

    return new Promise<void>((resolve, reject) => {
      const request = store.delete(`${date}_${activityId}`)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }, [])

  const getCompletionsForDate = useCallback(async (date: string): Promise<Completion[]> => {
    const database = await openDB()
    const tx = database.transaction('completions', 'readonly')
    const store = tx.objectStore('completions')
    const index = store.index('date')

    return new Promise((resolve, reject) => {
      const request = index.getAll(date)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }, [])

  const isActivityCompleted = useCallback(async (date: string, activityId: string): Promise<boolean> => {
    const database = await openDB()
    const tx = database.transaction('completions', 'readonly')
    const store = tx.objectStore('completions')

    return new Promise((resolve, reject) => {
      const request = store.get(`${date}_${activityId}`)
      request.onsuccess = () => resolve(!!request.result)
      request.onerror = () => reject(request.error)
    })
  }, [])

  // Schedules
  const saveDailySchedule = useCallback(async (schedule: DailySchedule) => {
    const database = await openDB()
    const tx = database.transaction('schedules', 'readwrite')
    const store = tx.objectStore('schedules')

    return new Promise<void>((resolve, reject) => {
      const request = store.put(schedule)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }, [])

  const getDailySchedule = useCallback(async (date: string): Promise<DailySchedule | null> => {
    const database = await openDB()
    const tx = database.transaction('schedules', 'readonly')
    const store = tx.objectStore('schedules')

    return new Promise((resolve, reject) => {
      const request = store.get(date)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }, [])

  // Week Plans
  const saveWeekPlan = useCallback(async (plan: WeekPlan) => {
    const database = await openDB()
    const tx = database.transaction('weekPlans', 'readwrite')
    const store = tx.objectStore('weekPlans')

    return new Promise<void>((resolve, reject) => {
      const request = store.put(plan)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }, [])

  const getWeekPlan = useCallback(async (weekStart: string): Promise<WeekPlan | null> => {
    const database = await openDB()
    const tx = database.transaction('weekPlans', 'readonly')
    const store = tx.objectStore('weekPlans')

    return new Promise((resolve, reject) => {
      const request = store.get(weekStart)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }, [])

  // Stats
  const getCurrentStreak = useCallback(async (): Promise<number> => {
    const database = await openDB()
    const tx = database.transaction('completions', 'readonly')
    const store = tx.objectStore('completions')
    const index = store.index('date')

    return new Promise((resolve, reject) => {
      const request = index.getAll()
      request.onsuccess = () => {
        const completions = request.result as Completion[]
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

        resolve(streak)
      }
      request.onerror = () => reject(request.error)
    })
  }, [])

  const getCompletionStats = useCallback(async (days: number): Promise<{ total: number; daysWithActivity: number }> => {
    const database = await openDB()
    const tx = database.transaction('completions', 'readonly')
    const store = tx.objectStore('completions')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const completions = request.result as Completion[]
        const today = new Date()
        const cutoff = new Date(today)
        cutoff.setDate(cutoff.getDate() - days)

        const recentCompletions = completions.filter(c => new Date(c.date) >= cutoff)
        const uniqueDays = new Set(recentCompletions.map(c => c.date))

        resolve({
          total: recentCompletions.length,
          daysWithActivity: uniqueDays.size
        })
      }
      request.onerror = () => reject(request.error)
    })
  }, [])

  return {
    isReady,
    saveCompletion,
    removeCompletion,
    getCompletionsForDate,
    isActivityCompleted,
    saveDailySchedule,
    getDailySchedule,
    saveWeekPlan,
    getWeekPlan,
    getCurrentStreak,
    getCompletionStats
  }
}
