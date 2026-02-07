/**
 * Building Nick - Date utility functions
 */

// US Federal Holidays for 2026
export const FEDERAL_HOLIDAYS_2026 = [
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-05-25', // Memorial Day
  '2026-06-19', // Juneteenth (observed)
  '2026-07-03', // Independence Day (observed - July 4 is Saturday)
  '2026-09-07', // Labor Day
  '2026-10-12', // Columbus Day
  '2026-11-11', // Veterans Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25'  // Christmas Day
]

export function formatDateFriendly(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

export function formatDateISO(date: Date): string {
  // Use local timezone instead of UTC to avoid date mismatch issues
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDateShort(date: Date): string {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return date.toLocaleDateString('en-US', options)
}

export function getDayOfWeek(date: Date): number {
  return date.getDay()
}

export function isWeekday(date: Date): boolean {
  const day = getDayOfWeek(date)
  return day >= 1 && day <= 5
}

export function isWeekend(date: Date): boolean {
  const day = getDayOfWeek(date)
  return day === 0 || day === 6
}

export function isFederalHoliday(date: Date): boolean {
  const dateStr = formatDateISO(date)
  return FEDERAL_HOLIDAYS_2026.includes(dateStr)
}

export function shouldShowProfessionalGoals(date: Date): boolean {
  return isWeekday(date) && !isFederalHoliday(date)
}

export function isSunday(date: Date): boolean {
  return getDayOfWeek(date) === 0
}

export function isToday(date: Date): boolean {
  const today = new Date()
  return formatDateISO(date) === formatDateISO(today)
}

export function getWeekStartDate(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekEndDate(date: Date): Date {
  const monday = getWeekStartDate(date)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return sunday
}

export function getWeekDates(date: Date): Date[] {
  const monday = getWeekStartDate(date)
  const dates: Date[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    dates.push(d)
  }

  return dates
}

export function getShortDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

export function getDayNumber(date: Date): number {
  return date.getDate()
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (mins === 0) {
    return `${hours} hr`
  }

  return `${hours} hr ${mins} min`
}

export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours()

  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export function getGreeting(): string {
  const timeOfDay = getTimeOfDay()

  switch (timeOfDay) {
    case 'morning':
      return 'Good morning'
    case 'afternoon':
      return 'Good afternoon'
    case 'evening':
      return 'Good evening'
    default:
      return 'Hello'
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' })
}

export function getYear(date: Date): number {
  return date.getFullYear()
}

export function formatTimeRange(startTimeIso: string, elapsedSeconds: number): string {
  // Strava's start_date_local represents local time but may include a trailing 'Z'.
  // Strip it so JavaScript parses as local time, not UTC.
  const localIso = startTimeIso.replace(/Z$/i, '')
  const start = new Date(localIso)
  const end = new Date(start.getTime() + elapsedSeconds * 1000)

  const formatTime = (d: Date) => {
    let hours = d.getHours()
    const minutes = d.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    const minStr = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''
    return { time: `${hours}${minStr}`, ampm }
  }

  const s = formatTime(start)
  const e = formatTime(end)

  // Same AM/PM: "2:30 - 4:41 PM", different: "11:30 AM - 1:15 PM"
  if (s.ampm === e.ampm) {
    return `${s.time} - ${e.time} ${e.ampm}`
  }
  return `${s.time} ${s.ampm} - ${e.time} ${e.ampm}`
}

export function getExtendedWeekDates(centerDate: Date, daysBeforeAfter: number = 14): Date[] {
  const dates: Date[] = []
  for (let i = -daysBeforeAfter; i <= daysBeforeAfter; i++) {
    dates.push(addDays(centerDate, i))
  }
  return dates
}
