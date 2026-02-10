/**
 * Building Nick - Push Notifications System
 *
 * Handles notification scheduling, message generation, and permission management.
 */

import { Completion, DailySchedule, TimeBlock } from '@/hooks/use-storage'
import { Reminder, getRemindersForDate } from './reminders'
import { MESSAGES, pickRandom } from './messages'

// Notification preferences storage key
const NOTIFICATION_PREFS_KEY = 'building_nick_notification_prefs'

// Time block definitions (matching reminders.ts)
export const TIME_BLOCKS: TimeBlock[] = [
  'before6am', 'before9am', 'beforeNoon', 'before230pm', 'before5pm', 'before9pm'
]

export const BLOCK_LABELS: Record<TimeBlock, string> = {
  'before6am': 'Early Morning',
  'before9am': 'Morning',
  'beforeNoon': 'Late Morning',
  'before230pm': 'Early Afternoon',
  'before5pm': 'Afternoon',
  'before9pm': 'Evening'
}

export const BLOCK_END_HOURS: Record<TimeBlock, number> = {
  'before6am': 6,
  'before9am': 9,
  'beforeNoon': 12,
  'before230pm': 14.5,
  'before5pm': 17,
  'before9pm': 21
}

export const BLOCK_START_HOURS: Record<TimeBlock, number> = {
  'before6am': 0,
  'before9am': 6,
  'beforeNoon': 9,
  'before230pm': 12,
  'before5pm': 14.5,
  'before9pm': 17
}

export interface NotificationTime {
  hour: number
  minute: number
  enabled: boolean
}

export interface NotificationPreferences {
  enabled: boolean
  times: NotificationTime[]
  lastNotificationTime?: string  // ISO timestamp
}

export interface NotificationContext {
  completedSinceLastNotification: string[]  // Activity/reminder names
  pendingItems: string[]  // Overdue or current block items not done
  upcomingItems: string[]  // Next block items
  allDayComplete: boolean
  currentBlock: TimeBlock
  nextBlock: TimeBlock | null
}

// Default notification times
export const DEFAULT_NOTIFICATION_TIMES: NotificationTime[] = [
  { hour: 8, minute: 15, enabled: true },
  { hour: 10, minute: 30, enabled: true },
  { hour: 13, minute: 0, enabled: true },
  { hour: 16, minute: 0, enabled: true },
  { hour: 20, minute: 45, enabled: true }
]

/**
 * Get current time block based on hour
 */
export function getCurrentTimeBlock(date: Date = new Date()): TimeBlock {
  const hour = date.getHours() + date.getMinutes() / 60

  if (hour < 6) return 'before6am'
  if (hour < 9) return 'before9am'
  if (hour < 12) return 'beforeNoon'
  if (hour < 14.5) return 'before230pm'
  if (hour < 17) return 'before5pm'
  return 'before9pm'
}

/**
 * Get the next time block after the given one
 */
export function getNextTimeBlock(currentBlock: TimeBlock): TimeBlock | null {
  const index = TIME_BLOCKS.indexOf(currentBlock)
  if (index === -1 || index === TIME_BLOCKS.length - 1) return null
  return TIME_BLOCKS[index + 1]
}

/**
 * Get notification preferences from localStorage
 */
export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === 'undefined') {
    return { enabled: false, times: DEFAULT_NOTIFICATION_TIMES }
  }

  try {
    const stored = localStorage.getItem(NOTIFICATION_PREFS_KEY)
    if (!stored) {
      return { enabled: false, times: DEFAULT_NOTIFICATION_TIMES }
    }
    return JSON.parse(stored)
  } catch (e) {
    console.error('Failed to load notification preferences:', e)
    return { enabled: false, times: DEFAULT_NOTIFICATION_TIMES }
  }
}

/**
 * Save notification preferences to localStorage
 */
export function saveNotificationPreferences(prefs: NotificationPreferences): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs))
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  return await Notification.requestPermission()
}

/**
 * Check if notifications are supported and permitted
 */
export function areNotificationsAvailable(): boolean {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  return Notification.permission === 'granted'
}

/**
 * Generate notification context based on current state
 */
export function buildNotificationContext(
  schedule: DailySchedule | null,
  completions: Completion[],
  reminders: Reminder[],
  lastNotificationTime: Date | null
): NotificationContext {
  const now = new Date()
  const currentBlock = getCurrentTimeBlock(now)
  const nextBlock = getNextTimeBlock(currentBlock)

  // Get completed items since last notification
  const completedSinceLastNotification: string[] = []
  const completionSet = new Set(completions.map(c => c.activityId))

  if (lastNotificationTime && schedule) {
    // Check all blocks up to current for completions
    for (const block of TIME_BLOCKS) {
      const blockActivities = schedule.activities[block] || []
      for (const activityId of blockActivities) {
        if (completionSet.has(activityId)) {
          // Check if completed after last notification
          const completion = completions.find(c => c.activityId === activityId)
          if (completion && new Date(completion.completedAt) > lastNotificationTime) {
            completedSinceLastNotification.push(activityId)
          }
        }
      }
    }

    // Check reminders completed since last notification
    for (const reminder of reminders) {
      if (reminder.isCompleted && reminder.completedInApp) {
        completedSinceLastNotification.push(reminder.title)
      }
    }
  }

  // Get pending items (current block and before, not completed)
  const pendingItems: string[] = []
  if (schedule) {
    const currentBlockIndex = TIME_BLOCKS.indexOf(currentBlock)
    for (let i = 0; i <= currentBlockIndex; i++) {
      const block = TIME_BLOCKS[i]
      const blockActivities = schedule.activities[block] || []
      for (const activityId of blockActivities) {
        if (!completionSet.has(activityId)) {
          pendingItems.push(activityId)
        }
      }
    }
  }

  // Add incomplete reminders from current block and before
  for (const reminder of reminders) {
    if (!reminder.isCompleted) {
      const reminderHour = reminder.dueDate.getHours() + reminder.dueDate.getMinutes() / 60
      const currentBlockEnd = BLOCK_END_HOURS[currentBlock]
      if (reminderHour <= currentBlockEnd || reminder.isAllDay) {
        pendingItems.push(reminder.title)
      }
    }
  }

  // Get upcoming items (next block)
  const upcomingItems: string[] = []
  if (schedule && nextBlock) {
    const nextBlockActivities = schedule.activities[nextBlock] || []
    for (const activityId of nextBlockActivities) {
      upcomingItems.push(activityId)
    }
  }

  // Check if all day is complete
  let allDayComplete = true
  if (schedule) {
    for (const block of TIME_BLOCKS) {
      const blockActivities = schedule.activities[block] || []
      for (const activityId of blockActivities) {
        if (!completionSet.has(activityId)) {
          allDayComplete = false
          break
        }
      }
      if (!allDayComplete) break
    }
  }

  // Check reminders too
  for (const reminder of reminders) {
    if (!reminder.isCompleted) {
      allDayComplete = false
      break
    }
  }

  return {
    completedSinceLastNotification,
    pendingItems,
    upcomingItems,
    allDayComplete,
    currentBlock,
    nextBlock
  }
}

/**
 * Generate notification message based on context
 */
export function generateNotificationMessage(
  context: NotificationContext,
  activityNames: Record<string, string>  // Map of activity ID to name
): { title: string; body: string } {
  const { completedSinceLastNotification, pendingItems, upcomingItems, allDayComplete, currentBlock, nextBlock } = context

  // Helper to get activity name
  const getName = (id: string) => activityNames[id] || id

  // All day complete - celebration message
  if (allDayComplete) {
    return {
      title: "You crushed it today!",
      body: pickRandom([
        "Every single item done. Tomorrow's looking even better.",
        "100% complete. That's how it's done.",
        "All done! Rest well, you've earned it.",
        "Perfect day. Your consistency is building something great."
      ])
    }
  }

  // Build message parts
  let title = ""
  let body = ""

  // Congrats for completed items
  if (completedSinceLastNotification.length > 0) {
    const completedNames = completedSinceLastNotification.slice(0, 3).map(getName)
    if (completedSinceLastNotification.length === 1) {
      title = `${completedNames[0]} done!`
    } else if (completedSinceLastNotification.length <= 3) {
      title = `${completedSinceLastNotification.length} items done!`
    } else {
      title = `${completedSinceLastNotification.length} items crushed!`
    }
  }

  // Pending items - encouragement
  if (pendingItems.length > 0) {
    const pendingNames = pendingItems.slice(0, 2).map(getName)
    if (!title) {
      title = `Time for ${pendingNames[0]}`
    }

    if (pendingItems.length === 1) {
      body = `${pendingNames[0]} is waiting. ${pickRandom(MESSAGES.countdown)}`
    } else {
      body = `${pendingNames.join(' and ')} are still on deck. ${pickRandom(['You got this!', 'Almost there!', 'Keep going!'])}`
    }
  } else if (upcomingItems.length > 0) {
    // Current block done - look ahead
    const upcomingNames = upcomingItems.slice(0, 2).map(getName)
    if (!title) {
      title = `${BLOCK_LABELS[currentBlock]} complete!`
    }
    body = `Coming up in ${BLOCK_LABELS[nextBlock!]}: ${upcomingNames.join(', ')}`
  } else {
    // Nothing pending, nothing upcoming - must be at end of day
    if (!title) {
      title = "Evening check-in"
    }
    body = pickRandom(MESSAGES.evening)
  }

  return { title, body }
}

/**
 * Show a notification immediately
 */
export async function showNotification(
  title: string,
  body: string,
  tag: string = 'building-nick'
): Promise<void> {
  console.log('[showNotification] Called with:', { title, body, tag })
  console.log('[showNotification] Notification API exists:', 'Notification' in window)
  console.log('[showNotification] Permission:', Notification?.permission)
  console.log('[showNotification] ServiceWorker exists:', 'serviceWorker' in navigator)

  // Check if we have permission
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('[showNotification] Notification permission not granted')
    return
  }

  try {
    // Wait for service worker with a timeout
    const swReady = new Promise<ServiceWorkerRegistration>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Service worker ready timeout'))
      }, 5000)

      navigator.serviceWorker.ready.then((registration) => {
        clearTimeout(timeout)
        resolve(registration)
      }).catch(reject)
    })

    console.log('[showNotification] Waiting for serviceWorker.ready (5s timeout)...')
    const registration = await swReady
    console.log('[showNotification] ServiceWorker ready, showing notification')

    await registration.showNotification(title, {
      body,
      tag,
      icon: '/apple-icon.png',
      badge: '/icon-light-32x32.png',
      vibrate: [100, 50, 100],
      requireInteraction: false,
      data: {
        url: '/',
        timestamp: new Date().toISOString()
      }
    })
    console.log('[showNotification] Notification shown successfully')

    // Update last notification time
    const prefs = getNotificationPreferences()
    prefs.lastNotificationTime = new Date().toISOString()
    saveNotificationPreferences(prefs)
  } catch (e) {
    console.error('[showNotification] SW notification failed, trying fallback:', e)

    // Fallback to basic Notification API (won't work on iOS but works on desktop)
    try {
      new Notification(title, {
        body,
        tag,
        icon: '/apple-icon.png'
      })
      console.log('[showNotification] Fallback notification sent')
    } catch (fallbackError) {
      console.error('[showNotification] Fallback also failed:', fallbackError)
    }
  }
}

/**
 * Calculate milliseconds until next scheduled notification
 */
export function getTimeUntilNextNotification(prefs: NotificationPreferences): number | null {
  if (!prefs.enabled) return null

  const enabledTimes = prefs.times.filter(t => t.enabled)
  if (enabledTimes.length === 0) return null

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // Find next notification time today
  for (const time of enabledTimes.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))) {
    const timeMinutes = time.hour * 60 + time.minute
    if (timeMinutes > currentMinutes) {
      const targetDate = new Date(now)
      targetDate.setHours(time.hour, time.minute, 0, 0)
      return targetDate.getTime() - now.getTime()
    }
  }

  // Next notification is tomorrow at first enabled time
  const firstTime = enabledTimes.sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute))[0]
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(firstTime.hour, firstTime.minute, 0, 0)
  return tomorrow.getTime() - now.getTime()
}

/**
 * Format time for display (e.g., "7:00 AM")
 */
export function formatNotificationTime(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  const displayMinute = minute.toString().padStart(2, '0')
  return `${displayHour}:${displayMinute} ${ampm}`
}

/**
 * Parse time string to hour/minute (e.g., "07:00" -> { hour: 7, minute: 0 })
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeStr.split(':')
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10)
  }
}
