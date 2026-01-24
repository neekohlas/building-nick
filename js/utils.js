/**
 * Building Nick - Utility Functions
 * Helper functions used throughout the app
 */

/**
 * Format a date as a friendly string
 * e.g., "Friday, January 24"
 */
function formatDateFriendly(date) {
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

/**
 * Format a date as YYYY-MM-DD
 */
function formatDateISO(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
function getDayOfWeek(date) {
  return date.getDay();
}

/**
 * Check if a date is a weekday (Mon-Fri)
 */
function isWeekday(date) {
  const day = getDayOfWeek(date);
  return day >= 1 && day <= 5;
}

/**
 * Check if a date is a weekend (Sat-Sun)
 */
function isWeekend(date) {
  const day = getDayOfWeek(date);
  return day === 0 || day === 6;
}

/**
 * Check if a date is a US Federal Holiday
 */
function isFederalHoliday(date) {
  const dateStr = formatDateISO(date);
  return FEDERAL_HOLIDAYS_2026.includes(dateStr);
}

/**
 * Check if professional goals should be shown today
 */
function shouldShowProfessionalGoals(date) {
  return isWeekday(date) && !isFederalHoliday(date);
}

/**
 * Check if today is Sunday (for weekly planning)
 */
function isSunday(date) {
  return getDayOfWeek(date) === 0;
}

/**
 * Get the Monday of the week containing the given date
 */
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the Sunday of the week containing the given date
 */
function getWeekEndDate(date) {
  const monday = getWeekStartDate(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return sunday;
}

/**
 * Get an array of dates for the current week
 */
function getWeekDates(date) {
  const monday = getWeekStartDate(date);
  const dates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  return dates;
}

/**
 * Get short day name (Mon, Tue, etc.)
 */
function getShortDayName(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Get day number
 */
function getDayNumber(date) {
  return date.getDate();
}

/**
 * Calculate days since last activity of a specific type
 */
async function daysSinceActivity(activityId) {
  let daysAgo = 0;
  let checkDate = new Date();

  while (daysAgo < 30) {
    const dateStr = formatDateISO(checkDate);
    const completed = await isActivityCompleted(dateStr, activityId);

    if (completed) {
      return daysAgo;
    }

    checkDate.setDate(checkDate.getDate() - 1);
    daysAgo++;
  }

  return -1; // Not found in last 30 days
}

/**
 * Check if an activity is due based on its frequency
 */
async function isActivityDue(activityId) {
  const activity = ACTIVITIES[activityId];

  if (!activity) return false;

  if (activity.frequency === 'every_2_3_days') {
    const daysSince = await daysSinceActivity(activityId);

    // Due if not done in last 2-3 days (or never done)
    return daysSince === -1 || daysSince >= 2;
  }

  return true; // Default: always due
}

/**
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 */
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate a simple unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format duration in minutes to friendly string
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${mins} min`;
}

/**
 * Get time of day (for context-aware messages)
 */
function getTimeOfDay() {
  const hour = new Date().getHours();

  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

/**
 * Get current hour (24h format)
 */
function getCurrentHour() {
  return new Date().getHours();
}

/**
 * Check if it's before a specific hour
 */
function isBeforeHour(hour) {
  return getCurrentHour() < hour;
}

/**
 * Check if it's after a specific hour
 */
function isAfterHour(hour) {
  return getCurrentHour() >= hour;
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Pick random item from array
 */
function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick N random items from array
 */
function pickRandomN(array, n) {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, n);
}

/**
 * Wait for a specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Get greeting based on time of day
 */
function getGreeting() {
  const timeOfDay = getTimeOfDay();

  switch (timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Good evening';
    default:
      return 'Hello';
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Check if the app is installed (standalone mode)
 */
function isAppInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

/**
 * Check if running on iOS
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Check if running on Safari
 */
function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Check if push notifications are supported
 */
function isPushSupported() {
  return 'PushManager' in window && 'serviceWorker' in navigator;
}

/**
 * Request notification permission
 */
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return 'denied';
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDateFriendly,
    formatDateISO,
    getDayOfWeek,
    isWeekday,
    isWeekend,
    isFederalHoliday,
    shouldShowProfessionalGoals,
    isSunday,
    getWeekStartDate,
    getWeekEndDate,
    getWeekDates,
    getShortDayName,
    getDayNumber,
    daysSinceActivity,
    isActivityDue,
    debounce,
    throttle,
    generateId,
    formatDuration,
    getTimeOfDay,
    getCurrentHour,
    isBeforeHour,
    isAfterHour,
    shuffleArray,
    pickRandom,
    pickRandomN,
    sleep,
    safeJsonParse,
    getGreeting,
    capitalize,
    truncate,
    isAppInstalled,
    isIOS,
    isSafari,
    isPushSupported,
    requestNotificationPermission
  };
}
