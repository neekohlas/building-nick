'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NotificationPreferences,
  NotificationContext,
  NotificationTime,
  DEFAULT_NOTIFICATION_TIMES,
  getNotificationPreferences,
  saveNotificationPreferences,
  requestNotificationPermission,
  areNotificationsAvailable,
  buildNotificationContext,
  generateNotificationMessage,
  showNotification,
  getTimeUntilNextNotification,
  getCurrentTimeBlock
} from '@/lib/notifications'
import {
  subscribeToPush,
  unsubscribeFromPush,
  updateNotificationTimes,
  isPushSupported
} from '@/lib/push-subscription'
import { Completion, DailySchedule } from '@/hooks/use-storage'
import { Reminder, getRemindersForDate } from '@/lib/reminders'

export interface UseNotificationsResult {
  // State
  permissionStatus: NotificationPermission | 'unsupported'
  preferences: NotificationPreferences
  isScheduled: boolean
  nextNotificationIn: number | null  // ms until next notification
  isPushSubscribed: boolean

  // Actions
  requestPermission: () => Promise<boolean>
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void
  addNotificationTime: (time: NotificationTime) => void
  removeNotificationTime: (index: number) => void
  updateNotificationTime: (index: number, time: Partial<NotificationTime>) => void
  sendTestNotification: () => Promise<void>
  checkAndSendNotification: (
    schedule: DailySchedule | null,
    completions: Completion[],
    activityNames: Record<string, string>
  ) => Promise<void>
}

export function useNotifications(): UseNotificationsResult {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default')
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: false,
    times: DEFAULT_NOTIFICATION_TIMES
  })
  const [isScheduled, setIsScheduled] = useState(false)
  const [nextNotificationIn, setNextNotificationIn] = useState<number | null>(null)
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)

  const schedulerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  // Load preferences and check permission on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check notification support
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported')
      return
    }

    setPermissionStatus(Notification.permission)

    // Load saved preferences
    const savedPrefs = getNotificationPreferences()
    setPreferences(savedPrefs)
  }, [])

  // Update countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      const ms = getTimeUntilNextNotification(preferences)
      setNextNotificationIn(ms)
    }

    updateCountdown()

    // Update every minute
    countdownRef.current = setInterval(updateCountdown, 60000)

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [preferences])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const permission = await requestNotificationPermission()
    setPermissionStatus(permission)
    return permission === 'granted'
  }, [])

  // Update preferences and sync with server
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    setPreferences(prev => {
      const newPrefs = { ...prev, ...updates }
      saveNotificationPreferences(newPrefs)

      // Sync with server in the background
      if (isPushSupported()) {
        const enabledTimes = newPrefs.times
          .filter(t => t.enabled)
          .map(t => ({ hour: t.hour, minute: t.minute }))

        if (newPrefs.enabled && enabledTimes.length > 0) {
          // Subscribe or update subscription
          subscribeToPush(enabledTimes).then(sub => {
            setIsPushSubscribed(!!sub)
            console.log('[Notifications] Push subscription updated')
          })
        } else if (!newPrefs.enabled) {
          // Unsubscribe if disabled
          unsubscribeFromPush().then(() => {
            setIsPushSubscribed(false)
            console.log('[Notifications] Push subscription removed')
          })
        }
      }

      return newPrefs
    })
  }, [])

  // Add a notification time
  const addNotificationTime = useCallback((time: NotificationTime) => {
    setPreferences(prev => {
      const newPrefs = {
        ...prev,
        times: [...prev.times, time].sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))
      }
      saveNotificationPreferences(newPrefs)

      // Sync with server
      if (isPushSupported() && newPrefs.enabled) {
        const enabledTimes = newPrefs.times
          .filter(t => t.enabled)
          .map(t => ({ hour: t.hour, minute: t.minute }))
        updateNotificationTimes(enabledTimes)
      }

      return newPrefs
    })
  }, [])

  // Remove a notification time
  const removeNotificationTime = useCallback((index: number) => {
    setPreferences(prev => {
      const newTimes = [...prev.times]
      newTimes.splice(index, 1)
      const newPrefs = { ...prev, times: newTimes }
      saveNotificationPreferences(newPrefs)

      // Sync with server
      if (isPushSupported() && newPrefs.enabled) {
        const enabledTimes = newPrefs.times
          .filter(t => t.enabled)
          .map(t => ({ hour: t.hour, minute: t.minute }))
        updateNotificationTimes(enabledTimes)
      }

      return newPrefs
    })
  }, [])

  // Update a notification time
  const updateNotificationTime = useCallback((index: number, updates: Partial<NotificationTime>) => {
    setPreferences(prev => {
      const newTimes = [...prev.times]
      newTimes[index] = { ...newTimes[index], ...updates }
      newTimes.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))
      const newPrefs = { ...prev, times: newTimes }
      saveNotificationPreferences(newPrefs)

      // Sync with server
      if (isPushSupported() && newPrefs.enabled) {
        const enabledTimes = newPrefs.times
          .filter(t => t.enabled)
          .map(t => ({ hour: t.hour, minute: t.minute }))
        updateNotificationTimes(enabledTimes)
      }

      return newPrefs
    })
  }, [])

  // Send a test notification
  const sendTestNotification = useCallback(async () => {
    console.log('[Notifications] Test notification requested')
    console.log('[Notifications] Permission status:', Notification?.permission)
    console.log('[Notifications] ServiceWorker available:', 'serviceWorker' in navigator)

    if (!areNotificationsAvailable()) {
      console.warn('[Notifications] Not available - permission:', Notification?.permission)
      // Try showing a basic notification without service worker as fallback
      if ('Notification' in window && Notification.permission === 'granted') {
        console.log('[Notifications] Trying basic notification fallback')
        new Notification('Test Notification', {
          body: 'Notifications are working!',
          icon: '/apple-icon.png'
        })
        return
      }
      return
    }

    await showNotification(
      'Test Notification',
      'Notifications are working! You\'ll receive check-ins at your scheduled times.',
      'building-nick-test'
    )
  }, [])

  // Check conditions and send notification if appropriate
  const checkAndSendNotification = useCallback(async (
    schedule: DailySchedule | null,
    completions: Completion[],
    activityNames: Record<string, string>
  ) => {
    if (!areNotificationsAvailable()) return
    if (!preferences.enabled) return

    // Get reminders for today
    const today = new Date()
    const reminders = getRemindersForDate(today)

    // Get last notification time
    const lastNotificationTime = preferences.lastNotificationTime
      ? new Date(preferences.lastNotificationTime)
      : null

    // Build context
    const context = buildNotificationContext(
      schedule,
      completions,
      reminders,
      lastNotificationTime
    )

    // Generate message
    const { title, body } = generateNotificationMessage(context, activityNames)

    // Show notification
    await showNotification(title, body)
  }, [preferences])

  return {
    permissionStatus,
    preferences,
    isScheduled,
    nextNotificationIn,
    isPushSubscribed,
    requestPermission,
    updatePreferences,
    addNotificationTime,
    removeNotificationTime,
    updateNotificationTime,
    sendTestNotification,
    checkAndSendNotification
  }
}

/**
 * Hook to schedule notifications based on user preferences.
 * Should be used in a component that has access to schedule and completions.
 */
export function useNotificationScheduler(
  schedule: DailySchedule | null,
  completions: Completion[],
  activityNames: Record<string, string>
) {
  const { preferences, checkAndSendNotification } = useNotifications()
  const schedulerRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckRef = useRef<string | null>(null)

  useEffect(() => {
    if (!preferences.enabled) {
      if (schedulerRef.current) {
        clearTimeout(schedulerRef.current)
        schedulerRef.current = null
      }
      return
    }

    const scheduleNextCheck = () => {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const currentKey = `${now.toDateString()}-${currentMinutes}`

      // Find if current time matches any notification time
      for (const time of preferences.times) {
        if (!time.enabled) continue

        const timeMinutes = time.hour * 60 + time.minute

        // Check if we're within the notification minute and haven't already fired
        if (currentMinutes === timeMinutes && lastCheckRef.current !== currentKey) {
          lastCheckRef.current = currentKey
          checkAndSendNotification(schedule, completions, activityNames)
          break
        }
      }

      // Schedule next check in 30 seconds
      schedulerRef.current = setTimeout(scheduleNextCheck, 30000)
    }

    scheduleNextCheck()

    return () => {
      if (schedulerRef.current) {
        clearTimeout(schedulerRef.current)
      }
    }
  }, [preferences, schedule, completions, activityNames, checkAndSendNotification])
}
