/**
 * Apple Reminders Sync Utility
 *
 * Handles parsing reminder data from iOS Shortcuts clipboard export,
 * storing reminders locally, and managing sync state.
 */

export interface Reminder {
  id: string           // Unique ID (title|dueDate from Shortcuts)
  title: string
  dueDate: Date
  isCompleted: boolean
  isAllDay: boolean    // true if time is midnight (12:00 AM)
  syncedAt: string     // ISO timestamp of last sync
  completedInApp?: boolean  // Track if completed within the app
}

export interface ReminderSyncResult {
  success: boolean
  added: number
  updated: number
  message: string
}

const REMINDERS_STORAGE_KEY = 'building_nick_reminders'
const REMINDERS_SYNC_TIME_KEY = 'building_nick_reminders_sync_time'

/**
 * Parse the date string from iOS Shortcuts
 * Format: "Jan 3, 2026 at 4:00 PM"
 */
function parseShortcutsDate(dateStr: string): Date {
  // Handle the "at" format from iOS Shortcuts
  const normalizedStr = dateStr.replace(' at ', ' ')
  const date = new Date(normalizedStr)

  if (isNaN(date.getTime())) {
    // Try parsing manually
    const match = dateStr.match(/(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+)\s+(AM|PM)/i)
    if (match) {
      const [, month, day, year, hour, minute, ampm] = match
      const months: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      }
      let h = parseInt(hour)
      if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
      return new Date(parseInt(year), months[month], parseInt(day), h, parseInt(minute))
    }
    throw new Error(`Could not parse date: ${dateStr}`)
  }

  return date
}

/**
 * Check if a date represents an all-day reminder (midnight)
 */
function isAllDayReminder(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0
}

/**
 * Parse clipboard JSON from iOS Shortcuts
 * Expected format: newline-separated JSON objects
 */
export function parseRemindersFromClipboard(clipboardText: string): Reminder[] {
  const lines = clipboardText.trim().split('\n')
  const reminders: Reminder[] = []
  const now = new Date().toISOString()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      // Parse the JSON, handling Yes/No for isCompleted
      const jsonStr = trimmed
        .replace(/:Yes\s*(,|})/g, ':true$1')
        .replace(/:No\s*(,|})/g, ':false$1')

      const data = JSON.parse(jsonStr)

      if (!data.id || !data.title || !data.dueDate) {
        console.warn('Skipping invalid reminder:', data)
        continue
      }

      const dueDate = parseShortcutsDate(data.dueDate)

      reminders.push({
        id: data.id,
        title: data.title,
        dueDate,
        isCompleted: data.isCompleted === true || data.isCompleted === 'Yes',
        isAllDay: isAllDayReminder(dueDate),
        syncedAt: now
      })
    } catch (e) {
      console.error('Failed to parse reminder line:', line, e)
    }
  }

  return reminders
}

/**
 * Get stored reminders from localStorage
 */
export function getStoredReminders(): Reminder[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(REMINDERS_STORAGE_KEY)
    if (!stored) return []

    const reminders = JSON.parse(stored)
    // Convert date strings back to Date objects
    return reminders.map((r: Reminder & { dueDate: string }) => ({
      ...r,
      dueDate: new Date(r.dueDate)
    }))
  } catch (e) {
    console.error('Failed to load stored reminders:', e)
    return []
  }
}

/**
 * Save reminders to localStorage
 */
export function saveReminders(reminders: Reminder[]): void {
  if (typeof window === 'undefined') return

  localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders))
  localStorage.setItem(REMINDERS_SYNC_TIME_KEY, new Date().toISOString())
}

/**
 * Get last sync time
 */
export function getLastRemindersSyncTime(): Date | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem(REMINDERS_SYNC_TIME_KEY)
  return stored ? new Date(stored) : null
}

/**
 * Sync reminders from clipboard data
 * - New reminders get added
 * - Existing reminders get updated (completion status, date changes)
 * - Preserves completedInApp flag
 */
export function syncReminders(newReminders: Reminder[]): ReminderSyncResult {
  const existing = getStoredReminders()
  const existingMap = new Map(existing.map(r => [r.id, r]))

  let added = 0
  let updated = 0

  const merged: Reminder[] = []

  for (const newReminder of newReminders) {
    const existing = existingMap.get(newReminder.id)

    if (!existing) {
      // New reminder
      merged.push(newReminder)
      added++
    } else {
      // Update existing - preserve completedInApp if it was completed in the app
      const mergedReminder: Reminder = {
        ...newReminder,
        completedInApp: existing.completedInApp
      }

      // If completed in Reminders app but not marked in our app, update
      if (newReminder.isCompleted && !existing.isCompleted) {
        mergedReminder.isCompleted = true
      }

      // If we completed it in app, keep that status
      if (existing.completedInApp) {
        mergedReminder.isCompleted = true
      }

      merged.push(mergedReminder)

      // Count as updated if anything changed
      if (existing.dueDate.getTime() !== newReminder.dueDate.getTime() ||
          existing.isCompleted !== mergedReminder.isCompleted ||
          existing.title !== newReminder.title) {
        updated++
      }

      existingMap.delete(newReminder.id)
    }
  }

  // Keep reminders that weren't in the sync (might be outside the date range)
  // but only if they're not too old (more than 2 months past)
  const twoMonthsAgo = new Date()
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

  for (const old of existingMap.values()) {
    if (old.dueDate >= twoMonthsAgo) {
      merged.push(old)
    }
  }

  // Sort by due date
  merged.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())

  saveReminders(merged)

  return {
    success: true,
    added,
    updated,
    message: `Synced ${newReminders.length} reminders (${added} new, ${updated} updated)`
  }
}

/**
 * Toggle completion status of a reminder in the app
 */
export function toggleReminderCompletion(reminderId: string): boolean {
  const reminders = getStoredReminders()
  const reminder = reminders.find(r => r.id === reminderId)

  if (!reminder) return false

  reminder.isCompleted = !reminder.isCompleted
  reminder.completedInApp = reminder.isCompleted

  saveReminders(reminders)
  return reminder.isCompleted
}

/**
 * Get reminders for a specific date (using local timezone)
 */
export function getRemindersForDate(date: Date): Reminder[] {
  const reminders = getStoredReminders()

  // Use local date components for comparison (not UTC)
  const targetYear = date.getFullYear()
  const targetMonth = date.getMonth()
  const targetDay = date.getDate()

  return reminders.filter(r => {
    const reminderYear = r.dueDate.getFullYear()
    const reminderMonth = r.dueDate.getMonth()
    const reminderDay = r.dueDate.getDate()
    return reminderYear === targetYear && reminderMonth === targetMonth && reminderDay === targetDay
  })
}

/**
 * Get overdue reminders (incomplete and past due)
 */
export function getOverdueReminders(asOfDate: Date): Reminder[] {
  const reminders = getStoredReminders()
  const today = new Date(asOfDate)
  today.setHours(0, 0, 0, 0)

  return reminders.filter(r => {
    if (r.isCompleted) return false
    const reminderDate = new Date(r.dueDate)
    reminderDate.setHours(0, 0, 0, 0)
    return reminderDate < today
  }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
}

/**
 * Get reminders for a time block (for display in today view)
 */
export function getRemindersForTimeBlock(
  date: Date,
  timeBlock: 'before6am' | 'before9am' | 'beforeNoon' | 'before230pm' | 'before5pm' | 'before9pm'
): Reminder[] {
  const dateReminders = getRemindersForDate(date)

  // Debug: log what reminders we found for this date
  if (dateReminders.length > 0 && timeBlock === 'before6am') {
    console.log('[getRemindersForTimeBlock] Reminders for date:', date.toLocaleDateString(), dateReminders.map(r => ({
      title: r.title,
      hour: r.dueDate.getHours(),
      minute: r.dueDate.getMinutes(),
      isAllDay: r.isAllDay,
      isCompleted: r.isCompleted
    })))
  }

  // Time block hour boundaries
  const blockEndHours: Record<string, number> = {
    'before6am': 6,
    'before9am': 9,
    'beforeNoon': 12,
    'before230pm': 14.5,
    'before5pm': 17,
    'before9pm': 21
  }

  const blockStartHours: Record<string, number> = {
    'before6am': 0,
    'before9am': 6,
    'beforeNoon': 9,
    'before230pm': 12,
    'before5pm': 14.5,
    'before9pm': 17
  }

  const startHour = blockStartHours[timeBlock]
  const endHour = blockEndHours[timeBlock]

  return dateReminders.filter(r => {
    // All-day reminders go in before6am block
    if (r.isAllDay) {
      return timeBlock === 'before6am'
    }

    const hour = r.dueDate.getHours() + r.dueDate.getMinutes() / 60
    return hour >= startHour && hour < endHour
  })
}

/**
 * Open the iOS Shortcut to sync reminders
 */
export function openRemindersSyncShortcut(): void {
  const shortcutName = 'SyncRemindersToHabitApp'
  const shortcutUrl = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}`
  window.location.href = shortcutUrl
}

/**
 * Check if we just returned from the shortcut (URL has fromShortcut param)
 */
export function checkForShortcutReturn(): boolean {
  if (typeof window === 'undefined') return false

  const params = new URLSearchParams(window.location.search)
  return params.get('fromShortcut') === 'reminders'
}

/**
 * Clear the shortcut return param from URL
 */
export function clearShortcutParam(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('fromShortcut')
  window.history.replaceState({}, '', url.toString())
}
